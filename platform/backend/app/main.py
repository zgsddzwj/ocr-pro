"""收购管理平台后端入口。

启动：cd platform/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
（或 python -m app.main）
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_DIST, HOST, PORT
from .db import init_db

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ocr-pro")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("收购管理平台已启动 http://%s:%s（局域网设备请用本机 IP 访问）", HOST, PORT)
    yield


app = FastAPI(title="收粮收购平台", version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started = time.monotonic()
    response = await call_next(request)
    path = request.url.path
    if path != "/api/health":
        logger.info(
            "%s %s -> %s (%dms)",
            request.method,
            path,
            response.status_code,
            int((time.monotonic() - started) * 1000),
        )
    return response


# 业务路由（/api/health、/api/ocr/idcard 与小程序契约一致）
from .routers.account import router as account_router  # noqa: E402
from .routers.farmers import router as farmers_router  # noqa: E402
from .routers.ocr import router as ocr_router  # noqa: E402
from .routers.records import router as records_router  # noqa: E402
from .routers.settings import router as settings_router  # noqa: E402
from .routers.stats import router as stats_router  # noqa: E402

app.include_router(ocr_router)
app.include_router(account_router)
app.include_router(farmers_router)
app.include_router(records_router)
app.include_router(settings_router)
app.include_router(stats_router)


@app.get("/api/{rest:path}", include_in_schema=False)
def api_fallback(rest: str):
    return JSONResponse({"ok": False, "error": "接口不存在"}, status_code=404)


# 前端静态资源（Vite 构建产物）；未构建时给出提示页
if (FRONTEND_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
def spa(full_path: str):
    if full_path.startswith("api"):
        return JSONResponse({"ok": False, "error": "接口不存在"}, status_code=404)

    if FRONTEND_DIST.is_dir():
        if full_path:
            candidate = (FRONTEND_DIST / full_path).resolve()
            try:
                candidate.relative_to(FRONTEND_DIST.resolve())
            except ValueError:
                candidate = None
            if candidate is not None and candidate.is_file():
                return FileResponse(candidate)
        index = FRONTEND_DIST / "index.html"
        if index.is_file():
            return FileResponse(index)

    return HTMLResponse(
        "<meta charset='utf-8'><h2>平台前端尚未构建</h2>"
        "<p>请在 platform/frontend 目录执行 <code>npm install &amp;&amp; npm run build</code>，然后重启本服务。</p>",
        status_code=200,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=HOST, port=PORT)
