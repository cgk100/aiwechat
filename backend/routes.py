import json
import logging
import sqlite3
import subprocess
import sys
import os
import time
from contextlib import closing
from typing import List, Optional, Dict

from fastapi import APIRouter, HTTPException

from .db import DB_PATH
from .models import (
    Friend, GroupItem, SendMessagePayload, SendHistoryItem,
    ScheduleMessagePayload, ScheduledJobItem,
    GroupCreate, GroupUpdate, FriendGroupUpdate,
    QAItem, QACreateUpdate, AITestPayload, AITestResponse,
    AISettingsResponse, AISettingsUpdate,
)
from .ai_qa import answer_question
from .wechat import WeChatSingleton

logger = logging.getLogger(__name__)

router = APIRouter()

# 自动回复运行状态（使用独立子进程便于停止）
auto_reply_proc: Optional[subprocess.Popen] = None
auto_reply_running: bool = False


# 好友列表
@router.get('/friends', response_model=List[Friend])
def get_friends():
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            rows = cur.execute(
                """
                SELECT f.id, f.name, f.msg, f.uid, f.created_at, f.updated_at,
                       f.group_id, g.name AS group_name
                FROM friends f
                LEFT JOIN groups g ON f.group_id = g.id
                ORDER BY f.id DESC
                """
            ).fetchall()
            friends: List[Friend] = []
            for r in rows:
                try:
                    msg_obj = json.loads(r["msg"]) if r["msg"] else {}
                except Exception:
                    msg_obj = {}

                gid_raw = r["group_id"]
                gid: Optional[int] = None
                if gid_raw not in (None, ""):
                    try:
                        gid = int(gid_raw)
                    except Exception:
                        gid = None

                friends.append(Friend(
                    id=r["id"],
                    name=r["name"],
                    uid=r["uid"],
                    local=msg_obj.get("地区", ""),
                    phone=msg_obj.get("电话", ""),
                    created_at=r["created_at"],
                    updated_at=r["updated_at"],
                    group_id=gid,
                    group_name=r["group_name"] if r["group_name"] else None
                ))
            return friends
    except Exception as e:
        logger.exception("查询好友列表失败")
        return []


# 分组列表
@router.get('/groups', response_model=List[GroupItem])
def list_groups():
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            rows = cur.execute(
                """
                SELECT g.id, g.name, g.created_at, g.updated_at,
                       (SELECT COUNT(*) FROM friends f WHERE f.group_id = g.id) AS friends_count
                FROM groups g
                ORDER BY g.id DESC
                """
            ).fetchall()
            return [
                GroupItem(
                    id=r['id'],
                    name=r['name'],
                    created_at=r['created_at'],
                    updated_at=r['updated_at'],
                    friends_count=r['friends_count']
                ) for r in rows
            ]
    except Exception as e:
        logger.exception("查询分组失败")
        return []


@router.post('/groups')
def create_group(payload: GroupCreate):
    name = (payload.name or '').strip()
    if not name:
        raise HTTPException(status_code=400, detail='分组名称不能为空')
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            cur = conn.cursor()
            cur.execute("INSERT INTO groups(name) VALUES (?)", (name,))
            conn.commit()
            return {"success": True}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail='分组名称已存在')
    except Exception as e:
        logger.exception("创建分组失败")
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/groups/{group_id}')
def update_group(group_id: int, payload: GroupUpdate):
    name = (payload.name or '').strip()
    if not name:
        raise HTTPException(status_code=400, detail='分组名称不能为空')
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            cur = conn.cursor()
            cur.execute("UPDATE groups SET name=? WHERE id=?", (name, group_id))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail='分组不存在')
            conn.commit()
            return {"success": True}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail='分组名称已存在')
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("更新分组失败")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete('/groups/{group_id}')
def delete_group(group_id: int):
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            cur = conn.cursor()
            cnt = cur.execute("SELECT COUNT(*) FROM friends WHERE group_id=?", (group_id,)).fetchone()[0]
            if cnt and cnt > 0:
                raise HTTPException(status_code=400, detail='分组下仍有好友，禁止删除')
            cur.execute("DELETE FROM groups WHERE id=?", (group_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail='分组不存在')
            conn.commit()
            return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("删除分组失败")
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/friends/{friend_id}/group')
def update_friend_group(friend_id: int, payload: FriendGroupUpdate):
    gid = payload.group_id
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            cur = conn.cursor()
            if gid is not None:
                g = cur.execute("SELECT id FROM groups WHERE id=?", (gid,)).fetchone()
                if not g:
                    raise HTTPException(status_code=404, detail='分组不存在')
            cur.execute("UPDATE friends SET group_id=? WHERE id=?", (gid, friend_id))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail='好友不存在')
            conn.commit()
            return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("更新好友分组失败")
        raise HTTPException(status_code=500, detail=str(e))


# 发送即时消息
@router.post('/send_message')
def api_send_message(payload: SendMessagePayload):
    try:
        friend_ids = payload.friendIds or []
        friend_names = payload.friendNames or {}
        content = (payload.content or '').strip()
        group_names = payload.groups or []

        if not friend_ids or not content:
            raise HTTPException(status_code=400, detail='缺少必要参数')

        wx = WeChatSingleton.get_instance()
        if not wx:
            raise HTTPException(status_code=500, detail='微信实例获取失败')

        success_count = 0
        failures = []
        for friend_id in friend_ids:
            try:
                name = friend_names.get(str(friend_id)) or friend_names.get(friend_id) or f'未知用户({friend_id})'
                wx.SendMsg(content, name)
                success_count += 1
            except Exception as e:
                failures.append({str(friend_id): str(e)})

        result = {
            'success': True,
            'total': len(friend_ids),
            'successCount': success_count,
            'failures': failures
        }
        logger.info(f"即时发送完成，总计 {len(friend_ids)}，成功 {success_count}，失败 {len(failures)}")

        # 写历史
        try:
            with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO send_history(content, groups, friend_ids, total, success_count) VALUES (?, ?, ?, ?, ?)",
                    (
                        content,
                        json.dumps(group_names, ensure_ascii=False),
                        json.dumps(friend_ids, ensure_ascii=False),
                        len(friend_ids),
                        success_count,
                    ),
                )
                conn.commit()
        except Exception as e:
            logger.warning(f"写入发送历史失败: {e}")

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"发送消息错误: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# 历史记录
@router.get('/send_history', response_model=List[SendHistoryItem])
def list_send_history():
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            rows = cur.execute(
                "SELECT id, content, groups, friend_ids, total, success_count, created_at FROM send_history ORDER BY id DESC"
            ).fetchall()
            items: List[SendHistoryItem] = []
            for r in rows:
                try:
                    groups = json.loads(r['groups']) if r['groups'] else []
                except Exception:
                    groups = []
                try:
                    fids = json.loads(r['friend_ids']) if r['friend_ids'] else []
                except Exception:
                    fids = []
                items.append(SendHistoryItem(
                    id=r['id'],
                    content=r['content'],
                    groups=groups,
                    friend_ids=fids,
                    total=r['total'],
                    success_count=r['success_count'],
                    created_at=r['created_at'],
                ))
            return items
    except Exception as e:
        logger.exception("查询发送历史失败")
        return []


# 创建定时任务
@router.post('/schedule_message')
def create_schedule_message(payload: ScheduleMessagePayload):
    content = (payload.content or '').strip()
    group_ids = payload.groupIds or []
    run_at = (payload.runAt or '').strip()
    if not content:
        raise HTTPException(status_code=400, detail='内容不能为空')
    if not group_ids:
        raise HTTPException(status_code=400, detail='请选择分组')
    if not run_at:
        raise HTTPException(status_code=400, detail='请选择执行时间')
    try:
        from datetime import datetime
        run_at_db = run_at
        try:
            dt = datetime.strptime(run_at, '%Y-%m-%dT%H:%M')
            if dt <= datetime.now():
                raise HTTPException(status_code=400, detail='执行时间需晚于当前时间')
            run_at_db = dt.strftime('%Y-%m-%d %H:%M:%S')
        except HTTPException:
            raise
        except Exception:
            run_at_db = run_at.replace('T', ' ')

        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            placeholders = ",".join(["?"]*len(group_ids))
            g_rows = cur.execute(
                f"SELECT name FROM groups WHERE id IN ({placeholders})",
                tuple(group_ids)
            ).fetchall() if group_ids else []
            group_names = [gr['name'] for gr in g_rows]

            cur.execute(
                "INSERT INTO scheduled_jobs(content, groups, group_ids, run_at, status) VALUES (?, ?, ?, ?, 'pending')",
                (
                    content,
                    json.dumps(group_names, ensure_ascii=False),
                    json.dumps(group_ids, ensure_ascii=False),
                    run_at_db,
                ),
            )
            conn.commit()
            job_id = cur.execute("SELECT last_insert_rowid() AS id").fetchone()[0]
            return {"success": True, "id": job_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("创建定时任务失败")
        raise HTTPException(status_code=500, detail=str(e))


# 查询定时任务
@router.get('/scheduled_jobs', response_model=List[ScheduledJobItem])
def list_scheduled_jobs():
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            rows = cur.execute(
                "SELECT id, content, groups, group_ids, run_at, status, total, success_count, error, created_at, updated_at FROM scheduled_jobs ORDER BY id DESC"
            ).fetchall()
            items: List[ScheduledJobItem] = []
            for r in rows:
                try:
                    groups = json.loads(r['groups']) if r['groups'] else []
                except Exception:
                    groups = []
                try:
                    gids = json.loads(r['group_ids']) if r['group_ids'] else []
                except Exception:
                    gids = []
                items.append(ScheduledJobItem(
                    id=r['id'],
                    content=r['content'],
                    groups=groups,
                    group_ids=gids,
                    run_at=r['run_at'],
                    status=r['status'],
                    total=r['total'],
                    success_count=r['success_count'],
                    error=r['error'] if r['error'] else None,
                    created_at=r['created_at'],
                    updated_at=r['updated_at'],
                ))
            return items
    except Exception as e:
        logger.exception("查询定时任务失败")
        return []


# 删除未执行的定时任务
@router.delete('/scheduled_jobs/{job_id}')
def delete_scheduled_job(job_id: int):
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            cur = conn.cursor()
            row = cur.execute("SELECT status FROM scheduled_jobs WHERE id=?", (job_id,)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail='定时任务不存在')
            status = row[0]
            if status != 'pending':
                raise HTTPException(status_code=400, detail='仅允许删除未执行的定时任务')
            cur.execute("DELETE FROM scheduled_jobs WHERE id=?", (job_id,))
            conn.commit()
            return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("删除定时任务失败")
        raise HTTPException(status_code=500, detail=str(e))


# 知识库：分页列表
@router.get('/qa_kb')
def list_qa_kb(offset: int = 0, limit: int = 10):
    try:
        if limit <= 0:
            limit = 10
        if offset < 0:
            offset = 0
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            total = cur.execute("SELECT COUNT(*) AS c FROM qa_kb").fetchone()[0]
            rows = cur.execute(
                "SELECT id, question, answer, created_at, updated_at FROM qa_kb ORDER BY id DESC LIMIT ? OFFSET ?",
                (limit, offset)
            ).fetchall()
            items = [
                QAItem(
                    id=r['id'],
                    question=r['question'],
                    answer=r['answer'],
                    created_at=r['created_at'],
                    updated_at=r['updated_at']
                ).dict()
                for r in rows
            ]
            return {"items": items, "total": total}
    except Exception as e:
        logger.exception("查询知识库失败")
        return {"items": [], "total": 0}


# 知识库：新增
@router.post('/qa_kb')
def create_qa_kb(payload: QACreateUpdate):
    q = (payload.question or '').strip()
    a = (payload.answer or '').strip()
    if not q or not a:
        raise HTTPException(status_code=400, detail='问题与答复均不能为空')
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            cur = conn.cursor()
            cur.execute("INSERT INTO qa_kb(question, answer) VALUES (?, ?)", (q, a))
            conn.commit()
            rid = cur.execute("SELECT last_insert_rowid() AS id").fetchone()[0]
            return {"success": True, "id": rid}
    except Exception as e:
        logger.exception("新增知识库失败")
        raise HTTPException(status_code=500, detail=str(e))


# 知识库：更新
@router.put('/qa_kb/{rid}')
def update_qa_kb(rid: int, payload: QACreateUpdate):
    q = (payload.question or '').strip()
    a = (payload.answer or '').strip()
    if not q or not a:
        raise HTTPException(status_code=400, detail='问题与答复均不能为空')
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            cur = conn.cursor()
            cur.execute("UPDATE qa_kb SET question=?, answer=?, updated_at=DATETIME('now','localtime') WHERE id=?", (q, a, rid))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail='条目不存在')
            conn.commit()
            return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("更新知识库失败")
        raise HTTPException(status_code=500, detail=str(e))


# 知识库：删除
@router.delete('/qa_kb/{rid}')
def delete_qa_kb(rid: int):
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM qa_kb WHERE id=?", (rid,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail='条目不存在')
            conn.commit()
            return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("删除知识库失败")
        raise HTTPException(status_code=500, detail=str(e))


# 系统提示词：读取
@router.get('/ai_settings', response_model=AISettingsResponse)
def get_ai_settings():
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            row = cur.execute("SELECT system_prompt, updated_at FROM ai_settings ORDER BY id DESC LIMIT 1").fetchone()
            if row:
                return AISettingsResponse(system=row['system_prompt'], updated_at=row['updated_at'])
            # 兜底：无记录时返回空字符串
            return AISettingsResponse(system="")
    except Exception as e:
        logger.exception("读取系统提示词失败")
        raise HTTPException(status_code=500, detail=str(e))


# 系统提示词：更新
@router.put('/ai_settings')
def update_ai_settings(payload: AISettingsUpdate):
    sys = (payload.system or '').strip()
    if not sys:
        raise HTTPException(status_code=400, detail='系统提示词不能为空')
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE ai_settings SET system_prompt=?, updated_at=DATETIME('now','localtime') WHERE id=(SELECT id FROM ai_settings ORDER BY id DESC LIMIT 1)",
                (sys,)
            )
            if cur.rowcount == 0:
                cur.execute("INSERT INTO ai_settings(system_prompt) VALUES (?)", (sys,))
            conn.commit()
            return {"success": True}
    except Exception as e:
        logger.exception("更新系统提示词失败")
        raise HTTPException(status_code=500, detail=str(e))


# AI 测试：调用大模型 + 本地知识库进行智能答复
@router.post('/ai_test', response_model=AITestResponse)
def ai_test(payload: AITestPayload):
    q = (payload.question or '').strip()
    if not q:
        raise HTTPException(status_code=400, detail='请输入问题')
    try:
        res = answer_question(q, payload.system)
        return AITestResponse(
            answer=res.get('answer', ''),
            matched_id=res.get('matched_id'),
            matched_question=res.get('matched_question')
        )
    except Exception as e:
        logger.exception("AI 测试失败")
        raise HTTPException(status_code=500, detail=str(e))


# 启动自动回复
@router.post('/api/start-auto-reply')
def start_auto_reply():
    """启动自动回复后台进程"""
    global auto_reply_proc, auto_reply_running

    try:
        if auto_reply_running:
            raise HTTPException(status_code=400, detail='自动回复已在运行中')

        # 使用独立 Python 进程运行监听脚本，便于可靠停止
        script_path = os.path.join(os.path.dirname(__file__), 'listen_new_message.py')
        if not os.path.exists(script_path):
            raise HTTPException(status_code=404, detail='监听脚本不存在')

        auto_reply_proc = subprocess.Popen([sys.executable, script_path], cwd=os.path.dirname(__file__))
        auto_reply_running = True
        logger.info("自动回复已启动")
        return {'success': True, 'message': '自动回复已启动'}
    except HTTPException:
        raise
    except Exception as e:
        auto_reply_running = False
        logger.error(f"启动自动回复失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 停止自动回复
@router.post('/api/stop-auto-reply')
def stop_auto_reply():
    """停止自动回复后台进程"""
    global auto_reply_proc, auto_reply_running

    try:
        if not auto_reply_running:
            raise HTTPException(status_code=400, detail='自动回复未在运行')

        if auto_reply_proc and auto_reply_proc.poll() is None:
            auto_reply_proc.terminate()
            auto_reply_proc.wait(timeout=10)
        auto_reply_proc = None
        auto_reply_running = False
        logger.info("自动回复已停止")
        return {'success': True, 'message': '自动回复已停止'}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"停止自动回复失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 修改好友备注
@router.post('/api/update-friend-remark')
def update_friend_remark(payload: dict):
    """修改好友备注"""
    try:
        friend_id = payload.get('friendId')
        new_remark = payload.get('newRemark', '').strip()

        # 验证参数
        if not friend_id or not new_remark:
            raise HTTPException(status_code=400, detail='缺少必要参数')

        # 从数据库获取好友信息
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM friends WHERE id=?", (friend_id,))
            friend = cursor.fetchone()

            if not friend:
                raise HTTPException(status_code=404, detail='好友不存在')

            friend_name = friend[0]

            # 获取微信实例
            wx = WeChatSingleton.get_instance()
            if not wx:
                raise HTTPException(status_code=500, detail='微信实例获取失败')

            # 使用wxautox修改好友备注
            try:
                # 先打开聊天窗口
                wx.ChatWith(friend_name)
                time.sleep(1.5)
                # 修改备注
                result = wx.ManageFriend(remark=new_remark)
                
                if not result:
                    raise HTTPException(status_code=500, detail='修改备注失败')
                
                logger.info(f"修改好友备注成功: 好友ID={friend_id}, 原名称={friend_name}, 新备注={new_remark}")

                # 更新数据库中的好友信息
                cursor.execute(
                    "UPDATE friends SET name=? WHERE id=?",
                    (new_remark, friend_id)
                )
                conn.commit()

                return {
                    'success': True,
                    'message': '修改备注成功',
                    'newName': new_remark
                }
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"修改好友备注异常: {str(e)}")
                raise HTTPException(status_code=500, detail=f'修改备注过程中发生异常: {str(e)}')

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"修改好友备注错误: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# 获取聊天历史记录
# 获取聊天记录
@router.post('/api/get-chat-history')
def get_chat_history(payload: dict):
    """获取好友聊天记录并保存到数据库"""
    try:
        friend_id = payload.get('friendId')
        friend_name = payload.get('friendName')
        load_more = payload.get('loadMore', False)
        
        if not friend_id or not friend_name:
            raise HTTPException(status_code=400, detail='缺少必要参数')
        
        # 获取微信实例
        wx = WeChatSingleton.get_instance()
        if not wx:
            raise HTTPException(status_code=500, detail='微信实例获取失败')
        
        # 使用wxautox获取历史记录
        try:
            # 先切换到该好友的聊天窗口
            wx.ChatWith(friend_name)
            time.sleep(1)
            
            # 如果是加载更多，调用LoadMoreMessage方法
            if load_more:
                try:
                    wx.LoadMoreMessage()
                    time.sleep(1)
                except Exception as load_error:
                    logger.warning(f"加载更多消息失败: {str(load_error)}")
            
            # 获取所有消息
            messages = wx.GetAllMessage()
            
            # 格式化消息并保存到数据库
            history = []
            with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
                cursor = conn.cursor()
                
                if messages and isinstance(messages, list):
                    for msg in messages:
                        sender = getattr(msg, 'sender', '未知')
                        content = getattr(msg, 'content', '')
                        msg_time = getattr(msg, 'time', '')
                        msg_type = getattr(msg, 'type', '')
                        
                        history.append({
                            'sender': sender,
                            'content': content,
                            'time': msg_time,
                            'type': msg_type
                        })
                        
                        # 保存到数据库（去重：检查是否已存在相同消息）
                        try:
                            cursor.execute(
                                """INSERT INTO chat_history (friend_id, friend_name, sender, content, msg_type, msg_time)
                                   SELECT ?, ?, ?, ?, ?, ?
                                   WHERE NOT EXISTS (
                                       SELECT 1 FROM chat_history 
                                       WHERE friend_id = ? AND sender = ? AND content = ? AND msg_time = ?
                                   )""",
                                (friend_id, friend_name, sender, content, msg_type, msg_time,
                                 friend_id, sender, content, msg_time)
                            )
                        except Exception as db_err:
                            logger.warning(f"保存消息到数据库失败: {db_err}")
                
                conn.commit()
            
            logger.info(f"获取聊天历史成功: 好友={friend_name}, 消息数量={len(history)}")
            
            return {
                'success': True,
                'history': history,
                'total': len(history)
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"获取聊天历史异常: {str(e)}")
            raise HTTPException(status_code=500, detail=f'获取历史记录过程中发生异常: {str(e)}')
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取聊天历史错误: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))