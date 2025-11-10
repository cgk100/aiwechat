import json
import logging
import sqlite3
import threading
import time
from contextlib import closing

from .db import DB_PATH
from .wechat import WeChatSingleton


logger = logging.getLogger(__name__)


def _run_scheduler_loop(stop_event: threading.Event):
    """
    简单调度循环
    - 每 3 秒检查一次 pending 任务
    - run_at 与本地时间比较，触发后更新状态与统计
    """
    while not stop_event.is_set():
        try:
            with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()

                # 使用本地时间进行触发比较
                rows = cur.execute(
                    """
                    SELECT * FROM scheduled_jobs
                    WHERE status='pending'
                      AND DATETIME(REPLACE(run_at,'T',' ')) <= DATETIME('now','localtime')
                    ORDER BY id ASC
                    LIMIT 10
                    """
                ).fetchall()

                if not rows:
                    time.sleep(3)
                    continue

                wx = WeChatSingleton.get_instance()
                if not wx:
                    logger.error("微信实例不可用，跳过本轮调度")
                    time.sleep(3)
                    continue

                for r in rows:
                    job_id = r['id']
                    content = r['content']
                    try:
                        group_ids = json.loads(r['group_ids']) if r['group_ids'] else []
                    except Exception:
                        group_ids = []

                    try:
                        # 获取分组下的好友名称
                        placeholders = ",".join(["?"] * len(group_ids)) if group_ids else None
                        friend_names = []
                        if placeholders:
                            f_rows = cur.execute(
                                f"SELECT name FROM friends WHERE group_id IN ({placeholders})",
                                tuple(group_ids)
                            ).fetchall()
                            friend_names = [fr['name'] for fr in f_rows]

                        success_count = 0
                        for name in friend_names:
                            try:
                                wx.SendMsg(content, name)
                                success_count += 1
                            except Exception as e:
                                logger.warning(f"向 {name} 发送失败: {e}")

                        cur.execute(
                            """
                            UPDATE scheduled_jobs
                            SET status='done',
                                total=?,
                                success_count=?,
                                updated_at=(DATETIME('now','localtime'))
                            WHERE id=?
                            """,
                            (len(friend_names), success_count, job_id)
                        )
                        conn.commit()
                        logger.info(f"定时任务 {job_id} 完成: {success_count}/{len(friend_names)}，内容: {content}")
                    except Exception as e:
                        logger.exception(f"执行定时任务 {job_id} 失败")
                        cur.execute(
                            """
                            UPDATE scheduled_jobs
                            SET status='failed',
                                error=?,
                                updated_at=(DATETIME('now','localtime'))
                            WHERE id=?
                            """,
                            (str(e), job_id)
                        )
                        conn.commit()
        except Exception as e:
            logger.exception(f"调度循环异常: {e}")
        finally:
            time.sleep(3)


_scheduler_stop_event: threading.Event = threading.Event()
_scheduler_thread: threading.Thread = None


def start_scheduler():
    """
    启动后台调度线程
    """
    global _scheduler_thread
    if _scheduler_thread and _scheduler_thread.is_alive():
        return
    _scheduler_thread = threading.Thread(target=_run_scheduler_loop, args=(_scheduler_stop_event,), daemon=True)
    _scheduler_thread.start()