import sqlite3
from contextlib import closing
import logging
import os


# 数据库文件路径（使用既有 wechat_friends.db，保持兼容前数据）
DB_PATH = os.path.join(os.path.dirname(__file__), 'wechat_friends.db')


def _exec(conn: sqlite3.Connection, sql: str, params=()):
    cur = conn.cursor()
    cur.execute(sql, params)
    return cur


def ensure_friends_table(conn: sqlite3.Connection):
    # 好友表：存基础资料与分组关联
    _exec(conn, """
    CREATE TABLE IF NOT EXISTS friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        uid TEXT NOT NULL,
        msg TEXT,
        group_id INTEGER,
        created_at DATETIME DEFAULT (DATETIME('now','localtime')),
        updated_at DATETIME DEFAULT (DATETIME('now','localtime'))
    )
    """)


def ensure_groups_table(conn: sqlite3.Connection):
    # 分组表：唯一名称约束
    _exec(conn, """
    CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT (DATETIME('now','localtime')),
        updated_at DATETIME DEFAULT (DATETIME('now','localtime'))
    )
    """)


def ensure_send_history_table(conn: sqlite3.Connection):
    # 发送历史：记录内容与统计
    _exec(conn, """
    CREATE TABLE IF NOT EXISTS send_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        groups TEXT,
        friend_ids TEXT,
        total INTEGER,
        success_count INTEGER,
        created_at DATETIME DEFAULT (DATETIME('now','localtime'))
    )
    """)


def ensure_scheduled_jobs_table(conn: sqlite3.Connection):
    # 定时任务：run_at 使用统一字符串格式
    _exec(conn, """
    CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        groups TEXT,
        group_ids TEXT,
        run_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        total INTEGER,
        success_count INTEGER,
        error TEXT,
        created_at DATETIME DEFAULT (DATETIME('now','localtime')),
        updated_at DATETIME DEFAULT (DATETIME('now','localtime'))
    )
    """)

def ensure_qa_kb_table(conn: sqlite3.Connection):
    # 问答知识库表：记录问答条目
    _exec(conn, """
    CREATE TABLE IF NOT EXISTS qa_kb (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at DATETIME DEFAULT (DATETIME('now','localtime')),
        updated_at DATETIME DEFAULT (DATETIME('now','localtime'))
    )
    """)


def ensure_ai_settings_table(conn: sqlite3.Connection):
    # 系统提示词设置表：仅需一条记录，保存当前 system 提示词
    _exec(conn, """
    CREATE TABLE IF NOT EXISTS ai_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        system_prompt TEXT NOT NULL,
        created_at DATETIME DEFAULT (DATETIME('now','localtime')),
        updated_at DATETIME DEFAULT (DATETIME('now','localtime'))
    )
    """)
    # 确保至少有一条默认记录
    cur = _exec(conn, "SELECT COUNT(*) AS c FROM ai_settings")
    cnt = cur.fetchone()[0]
    if not cnt:
        default_prompt = (
            "你是知识库问答助手。请严格依据知识库提供的答案作答，"
            "回答简洁、礼貌、可执行；如知识库不足以覆盖问题，说明需要更多信息，"
            "并建议补充知识库。优先使用中文。"
        )
        _exec(conn, "INSERT INTO ai_settings(system_prompt) VALUES (?)", (default_prompt,))


def ensure_chat_history_table(conn: sqlite3.Connection):
    # 聊天记录表：存储好友聊天历史
    _exec(conn, """
    CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        friend_id INTEGER NOT NULL,
        friend_name TEXT NOT NULL,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        msg_type TEXT,
        msg_time TEXT,
        created_at DATETIME DEFAULT (DATETIME('now','localtime')),
        FOREIGN KEY (friend_id) REFERENCES friends(id)
    )
    """)


def ensure_all_tables():
    """
    初始化所有必要的数据表
    """
    try:
        with closing(sqlite3.connect(DB_PATH, check_same_thread=False)) as conn:
            ensure_friends_table(conn)
            ensure_groups_table(conn)
            ensure_send_history_table(conn)
            ensure_scheduled_jobs_table(conn)
            ensure_qa_kb_table(conn)
            ensure_ai_settings_table(conn)
            ensure_chat_history_table(conn)
            conn.commit()
    except Exception as e:
        logging.exception("初始化数据库失败")
        raise