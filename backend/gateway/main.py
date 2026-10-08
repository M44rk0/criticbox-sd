import os
import sys

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

load_dotenv()

import time

from common.telemetry import configure_service_logger, generate_request_id, set_request_id
from gateway.exception_handlers import register_exception_handlers
from gateway.routers import auth_router, movies_router, reviews_router

logger = configure_service_logger("Gateway")

app = FastAPI(
    title="Criticbox SD - API Gateway Distribuído",
    description="API Gateway centralizador com autenticação JWT e orquestração gRPC para microsserviços internos.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)


@app.middleware("http")
async def trace_middleware(request: Request, call_next):
    # Ignora ruído de logs em assets estáticos se houver
    if request.url.path.startswith("/assets") or request.url.path in ("/favicon.ico", "/criticbox_home.html"):
        return await call_next(request)

    req_id = request.headers.get("x-request-id") or generate_request_id()
    set_request_id(req_id)
    t0 = time.perf_counter()
    logger.info("--> %s %s", request.method, request.url.path)
    try:
        response = await call_next(request)
        elapsed = (time.perf_counter() - t0) * 1000
        logger.info("<-- %d %s %s (%.1fms)", response.status_code, request.method, request.url.path, elapsed)
        response.headers["X-Request-ID"] = req_id
        return response
    except Exception as e:
        elapsed = (time.perf_counter() - t0) * 1000
        logger.error("<-- 500 %s %s (%.1fms): %s", request.method, request.url.path, elapsed, e)
        raise


HOME_HTML_PATH = os.path.join(BASE_DIR, "criticbox_home.html")
FRONTEND_DIST_DIR = os.path.join(BASE_DIR, "frontend", "dist")
FRONTEND_ASSETS_DIR = os.path.join(FRONTEND_DIST_DIR, "assets")

if os.path.exists(FRONTEND_ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS_DIR), name="static-assets")


@app.get("/", summary="Página inicial ou status da API")
def root(request: Request):
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        react_index = os.path.join(FRONTEND_DIST_DIR, "index.html")
        if os.path.exists(react_index):
            return FileResponse(react_index)
        if os.path.exists(HOME_HTML_PATH):
            return FileResponse(HOME_HTML_PATH)
    return {
        "status": "online",
        "gateway": "Criticbox SD API Gateway v2.0",
        "docs_url": "/docs",
        "services": {
            "user_service": "gRPC :50053",
            "movie_service": "gRPC :50051",
            "review_service": "gRPC :50052",
        },
    }


@app.get("/app", summary="Acessa o app React construído")
def app_frontend():
    react_index = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.exists(react_index):
        return FileResponse(react_index)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Frontend não encontrado.")


app.include_router(auth_router)
app.include_router(movies_router)
app.include_router(reviews_router)


@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(request: Request, full_path: str):
    accept = request.headers.get("accept", "")
    react_index = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.exists(react_index) and ("text/html" in accept or "." not in full_path):
        return FileResponse(react_index)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Não encontrado.")


def start():
    uvicorn.run("gateway.main:app", host="0.0.0.0", port=int(os.getenv("API_PORT", "8000")), reload=True)


if __name__ == "__main__":
    start()
