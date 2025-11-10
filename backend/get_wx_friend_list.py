import sqlite3
import json
import time
from datetime import datetime
import os
import logging
# pythoncom 可能依赖 pywin32/win32gui，容错处理
try:
    import pythoncom
except Exception:
    pythoncom = None
import sqlite3
from logging.handlers import RotatingFileHandler
import argparse

def get_db_path(db_path: str | None = None) -> str:
    # 优先使用传入路径，否则定位到脚本同目录
    if db_path:
        return db_path
    base_dir = os.path.dirname(__file__)
    return os.path.join(base_dir, 'wechat_friends.db')

def setup_logging():
    logger = logging.getLogger('wx_sync')
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s')

    # 控制台
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 滚动文件
    log_dir = os.path.join(os.path.dirname(__file__), 'wxauto_logs')
    os.makedirs(log_dir, exist_ok=True)
    file_handler = RotatingFileHandler(os.path.join(log_dir, 'sync.log'), maxBytes=1_000_000, backupCount=3, encoding='utf-8')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    return logger

def ensure_friend_table(conn):
    cursor = conn.cursor()
    
    # 直接创建包含所有必要列的表结构（如果不存在）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS friends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            msg TEXT NOT NULL,
            uid TEXT NOT NULL,
            group_id INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 创建必要的索引（如果不存在）
    cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_friends_uid ON friends(uid)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_friends_name ON friends(name)')
    
    # 检查并创建触发器（如果不存在）
    cursor.execute('''
        SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_friends_updated_at'
    ''')
    if not cursor.fetchone():
        cursor.execute('''
            CREATE TRIGGER trg_friends_updated_at
            AFTER UPDATE ON friends
            BEGIN
                UPDATE friends SET updated_at = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
            END;
        ''')
    
    # 兼容已存在的 friends 表：若缺少 group_id 列则补齐
    try:
        cursor.execute("PRAGMA table_info('friends')")
        cols = {row[1] for row in cursor.fetchall()}
        if 'group_id' not in cols:
            cursor.execute("ALTER TABLE friends ADD COLUMN group_id INTEGER DEFAULT 0")
    except Exception:
        # 忽略列检查失败，不影响后续流程
        pass

    conn.commit()

# 修改sync_friends函数定义，移除max_retry参数
def sync_friends(db_path: str | None = None):
    # 初始化logger
    logger = setup_logging()

    # 初始化COM组件（处理多线程环境下的COM初始化问题）
    try:
        if pythoncom:
            pythoncom.CoInitialize()
            logger.info("COM组件初始化成功")
        else:
            logger.warning("pythoncom 不可用，跳过 COM 组件初始化")
    except Exception as e:
        logger.warning(f"COM组件初始化失败，但继续执行: {str(e)}")

    # 创建SQLite数据库连接
    conn = sqlite3.connect(get_db_path(db_path))
    cursor = conn.cursor()

    # 调优：WAL 模式与同步级别（在本地单实例下有更好吞吐）
    # 为异常添加日志记录
    try:
        cursor.execute('PRAGMA journal_mode=WAL;')
        cursor.execute('PRAGMA synchronous=NORMAL;')
        cursor.execute('PRAGMA busy_timeout=5000;')
    except Exception as e:
        logger.warning(f"设置数据库参数失败: {str(e)}")
        pass

    # 确保表存在（在调用 WeChat 前执行，避免因环境缺失导致表未建成）
    ensure_friend_table(conn)

    try:
        # 延迟导入 WeChat，避免模块导入阶段失败
        from wxautox import WeChat
        wx = WeChat()
    except Exception as e:
        logger.error(f"初始化 WeChat 失败: {e}")
        # 即使无法同步好友，也不抛出致命错误，让后端可继续提供已有数据服务
        cursor.close()
        conn.close()
        return

    processed_friends = set()  # 用于跟踪已处理的好友，避免重复

    logger.info("开始一次性获取全部好友...")

    try:
        messages = wx.GetFriendDetails()
        if not messages:
            logger.warning("未获取到好友列表")
        elif not isinstance(messages, list):
            logger.error("GetFriendDetails 返回非列表，忽略该次结果")
        else:
            logger.info(f"成功获取 {len(messages)} 位好友，开始对账式同步...")
            try:
                conn.execute('BEGIN IMMEDIATE')

                # 临时表：保存本次获取到的 uid 集合
                cursor.execute('DROP TABLE IF EXISTS tmp_latest_uid')
                cursor.execute('CREATE TEMP TABLE tmp_latest_uid (uid TEXT PRIMARY KEY)')

                # 遍历数据并 UPSERT
                insert_latest_uids = []
                for message in messages:
                    if not isinstance(message, dict):
                        logger.warning("跳过非字典类型的好友记录")
                        continue
                    remark = (message.get('备注') or '').strip()
                    nickname = (message.get('昵称') or '未知').strip()
                    name = remark if remark else nickname or '未知'
                    wechat_id = (message.get('微信号') or '').strip()

                    # 生成稳定唯一键：优先微信号；没有则退化为 name_微信号（均可能为空，尽力而为）
                    # 改进UID生成逻辑，确保唯一性
                    uid = wechat_id if wechat_id else f"{name}_{int(time.time()*1000)}"

                    if not uid:
                        continue
                    if uid in processed_friends:
                        continue
                    processed_friends.add(uid)

                    insert_latest_uids.append((uid,))

                    msg_json = json.dumps(message, ensure_ascii=False)
                    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

                    # UPSERT：按 uid 插入或仅在变更时更新（updated_at 由触发器维护）
                    try:
                        cursor.execute(
                            'INSERT INTO friends (uid, name, msg, created_at, updated_at)\n'
                            'VALUES (?, ?, ?, ?, ?)\n'
                            'ON CONFLICT(uid) DO UPDATE SET\n'
                            '  name=excluded.name,\n'
                            '  msg=excluded.msg\n'
                            'WHERE name != excluded.name OR msg != excluded.msg',
                            (uid, name, msg_json, current_time, current_time)
                        )
                    except Exception as row_e:
                        logger.warning(f"写入单条好友记录失败，已跳过：{row_e}")

                if insert_latest_uids:
                    cursor.executemany('INSERT OR IGNORE INTO tmp_latest_uid(uid) VALUES (?)', insert_latest_uids)
                
                # 删除不在最新集合中的行    
                cursor.execute('DELETE FROM friends WHERE NOT EXISTS (SELECT 1 FROM tmp_latest_uid WHERE tmp_latest_uid.uid = friends.uid)')

                conn.commit()
                # 统计
                try:
                    cursor.execute('SELECT COUNT(1) FROM friends')
                    total = cursor.fetchone()[0]
                except Exception:
                    total = -1
                logger.info(f"好友表同步完成（UPSERT + 差集删除），当前总数：{total}")
            except Exception as e:
                conn.rollback()
                logger.error(f"一次性获取出错: {str(e)}")

    except Exception as e:
        logger.exception(f"整体获取过程中出错: {str(e)}")
        # 发生错误时也提交已处理的数据
        try:
            conn.commit()
        except Exception:
            pass

    finally:
        # 关闭数据库连接
        cursor.close()
        conn.close()
        logger.info(f"好友列表已全部获取并存储到数据库，共 {len(processed_friends)} 位好友")

# 修改parse_args函数，移除--max-retry参数
def parse_args():
    parser = argparse.ArgumentParser(description='Sync WeChat friends to SQLite database')
    parser.add_argument('--db', dest='db', type=str, default=None, help='Path to SQLite database file')
    return parser.parse_args()

if __name__ == '__main__':
    # 直接运行脚本时执行同步
    args = parse_args()
    # 不再传递max_retry参数
    sync_friends(db_path=args.db)