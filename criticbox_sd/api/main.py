import logging
import os
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from criticbox_sd.api.schemas import (
    MovieSummary,
    ReviewCreateRequest,
    ReviewResponse,
    SearchMoviesResponse,
)
from criticbox_sd.server import database, tmdb_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [API REST] %(message)s")
logger = logging.getLogger("criticbox-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    yield


app = FastAPI(title="Criticbox SD - API REST", lifespan=lifespan)


ERROR_TEMPLATES = {
    "missing": "Campo obrigatório e não informado.",
    "string_too_short": "Deve conter no mínimo {min_length} caractere(s).",
    "string_too_long": "Deve conter no máximo {max_length} caracteres.",
    "greater_than": "O valor deve ser maior que {gt}.",
    "greater_than_equal": "O valor deve ser no mínimo {ge}.",
    "less_than_equal": "O valor deve ser no máximo {le}.",
    "int_parsing": "Deve ser um número inteiro válido.",
    "int_type": "Deve ser um número inteiro válido.",
    "float_parsing": "Deve ser um número decimal válido.",
    "float_type": "Deve ser um número decimal válido.",
    "bool_parsing": "Deve ser verdadeiro (true) ou falso (false).",
    "bool_type": "Deve ser verdadeiro (true) ou falso (false).",
    "json_invalid": "O corpo da requisição deve ser um JSON válido.",
}


def _format_error_msg(err: dict) -> str:
    msg = err.get("msg", "Valor inválido").removeprefix("Value error, ")
    if msg != err.get("msg"):
        return msg
    template = ERROR_TEMPLATES.get(err.get("type", ""))
    return template.format(**err.get("ctx", {})) if template else msg


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    erros = [
        {
            "campo": str(err.get("loc", ())[-1]) if err.get("loc") else "corpo",
            "mensagem": _format_error_msg(err),
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


@app.get("/movies", response_model=SearchMoviesResponse)
def search_movies(
    query: str = Query(..., min_length=1, description="Termo de busca do filme"),
    page: int = Query(default=1, ge=1, description="Página de resultados"),
):
    q = query.strip()
    if not q:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "mensagem": "Dados inválidos",
                "erros": [{"campo": "query", "mensagem": "O parâmetro de busca 'query' não pode estar em branco."}],
            },
        )
    logger.info("GET /movies -> Buscando: '%s' (Página %d)", q, page)
    data = tmdb_service.search_movies(q, page)
    movies = []
    for item in data.get("results", []):
        stats = database.get_movie_stats(item["id"])
        movies.append(
            MovieSummary(
                tmdb_id=item["id"],
                title=item["title"],
                release_date=item.get("release_date") or "",
                poster_url=item.get("poster_url") or "",
                overview=item.get("overview") or "",
                tmdb_vote_average=round(float(item.get("tmdb_vote_average", 0.0)), 1),
                criticbox_rating=stats["average_rating"],
                criticbox_review_count=stats["total_count"],
            )
        )
    return SearchMoviesResponse(
        page=data.get("page", 1),
        total_results=data.get("total_results", len(movies)),
        movies=movies,
    )


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
