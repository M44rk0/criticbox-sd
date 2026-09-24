import logging
import os
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from criticbox_sd.api.schemas import ReviewCreateRequest, ReviewResponse
from criticbox_sd.server import database

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [API REST] %(message)s")
logger = logging.getLogger("criticbox-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    yield


app = FastAPI(title="Criticbox SD - API REST", lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    erros = [
        {
            "campo": str(err.get("loc", ())[-1]) if err.get("loc") else "corpo",
            "mensagem": err.get("msg", "Valor inválido").removeprefix("Value error, "),
        }
        for err in exc.errors()
    ]
    logger.warning("Validação falhou: %s", erros)
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"mensagem": "Dados inválidos", "erros": erros},
    )


@app.get("/")
def root():
    return {"status": "online", "docs_url": "/docs"}


@app.post("/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(payload: ReviewCreateRequest):
    logger.info("POST /reviews -> @%s | Filme: %d | Nota: %.1f", payload.user_id, payload.tmdb_id, payload.rating)
    return database.add_review(
        tmdb_id=payload.tmdb_id,
        user_id=payload.user_id,
        rating=payload.rating,
        comment=payload.comment or "",
        contains_spoilers=payload.contains_spoilers,
    )


@app.get("/reviews", response_model=list[ReviewResponse])
def list_reviews():
    return database.get_all_reviews()


def start():
    uvicorn.run("criticbox_sd.api.main:app", host="0.0.0.0", port=int(os.getenv("API_PORT", "8000")), reload=True)


if __name__ == "__main__":
    start()
