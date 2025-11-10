import logging
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 兼容直接脚本运行：确保可以使用绝对导入 backend.*
if __name__ == "__main__":
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if ROOT not in sys.path:
        sys.path.insert(0, ROOT)

from backend.db import ensure_all_tables
from backend.scheduler import start_scheduler
from backend.routes import router as api_router


def create_app() -> FastAPI:
    """
    创建并返回 FastAPI 应用
    - 初始化数据库表
    - 注册路由
    - 启动后台调度
    """
    logging.basicConfig(level=logging.INFO)
    app = FastAPI()

    # 允许前端跨域访问
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 初始化数据库
    ensure_all_tables()

    # 注册 API 路由
    app.include_router(api_router)

    # 启动调度器
    start_scheduler()

    return app


# 供 ASGI 使用
app = create_app()


if __name__ == "__main__":
    # 允许直接运行：uv run backend\main.py 或 python backend/main.py
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)