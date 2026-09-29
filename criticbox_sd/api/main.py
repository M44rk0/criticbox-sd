import logging
import os
import sys

import grpc
import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

load_dotenv()

from criticbox_sd.api.auth import create_access_token, get_current_user
from criticbox_sd.api.grpc_clients import get_grpc_manager
from criticbox_sd.api.schemas import (
    AuthResponse,
    MovieDetailsResponse,
    ReviewCreateRequest,
    ReviewListItem,
    ReviewResponse,
    SearchMoviesResponse,
    UserLoginRequest,
    UserProfileResponse,
    UserRegisterRequest,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [API Gateway] %(message)s")
logger = logging.getLogger("criticbox-gateway")

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
    logger.warning("Validação falhou na borda (Gateway): %s", erros)
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"mensagem": "Dados inválidos", "erros": erros},
    )


from fastapi.staticfiles import StaticFiles

# ----------------- UI & Health Endpoints ----------------- #
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
        "docs_url": "/docs",
        "app_url": "/app",
        "gateway": "FastAPI -> gRPC Microservices (MovieService:50051, ReviewService:50052)",
    }


@app.get("/app", summary="Interface Web do Criticbox (Frontend)")
def get_app():
    react_index = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.exists(react_index):
        return FileResponse(react_index)
    if os.path.exists(HOME_HTML_PATH):
        return FileResponse(HOME_HTML_PATH)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Frontend não encontrado.")


# ----------------- Auth Endpoints (JWT) ----------------- #
@app.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED, summary="Registro de novo usuário")
def register_user(payload: UserRegisterRequest):
    logger.info("Gateway POST /auth/register -> Registrando @%s via gRPC", payload.username)
    grpc_manager = get_grpc_manager()
    try:
        res = grpc_manager.register_user(payload.username, payload.password)
    except grpc.RpcError as e:
        logger.error("gRPC Error no ReviewService: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço interno de usuários indisponível.",
        )

    if not res["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res["message"],
        )

    token = create_access_token(data={"sub": res["user_id"], "username": res["username"]})
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user_id=res["user_id"],
        username=res["username"],
        message=res["message"],
    )


@app.post("/auth/login", response_model=AuthResponse, status_code=status.HTTP_200_OK, summary="Autenticação e geração de JWT")
def login_user(payload: UserLoginRequest):
    logger.info("Gateway POST /auth/login -> Autenticando @%s via gRPC", payload.username)
    grpc_manager = get_grpc_manager()
    try:
        res = grpc_manager.authenticate_user(payload.username, payload.password)
    except grpc.RpcError as e:
        logger.error("gRPC Error no ReviewService: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço interno de usuários indisponível.",
        )

    if not res["success"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=res["message"],
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": res["user_id"], "username": res["username"]})
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user_id=res["user_id"],
        username=res["username"],
        message=res["message"],
    )


@app.get("/auth/me", response_model=UserProfileResponse, summary="Perfil do usuário autenticado")
def get_my_profile(current_user: dict = Depends(get_current_user)):
    return UserProfileResponse(
        user_id=current_user["user_id"],
        username=current_user["username"],
    )


# ----------------- Movies Endpoints (gRPC MovieService) ----------------- #
@app.get("/movies", response_model=SearchMoviesResponse, summary="Busca filmes no catálogo TMDb via gRPC")
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
    logger.info("Gateway GET /movies -> Chamando MovieService gRPC: query='%s', page=%d", q, page)
    grpc_manager = get_grpc_manager()
    try:
        data = grpc_manager.search_movies(query=q, page=page)
        return SearchMoviesResponse(**data)
    except grpc.RpcError as e:
        logger.error("gRPC Error no MovieService: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço interno de catálogo de filmes indisponível.",
        )


@app.get("/movies/trending", response_model=SearchMoviesResponse, summary="Filmes em alta via gRPC")
def get_trending_movies(
    time_window: str = Query(default="week", pattern="^(day|week)$", description="Janela de tempo: day ou week"),
    page: int = Query(default=1, ge=1, description="Página de resultados"),
):
    logger.info("Gateway GET /movies/trending -> Chamando MovieService gRPC (%s, %d)", time_window, page)
    grpc_manager = get_grpc_manager()
    try:
        data = grpc_manager.get_trending_movies(time_window=time_window, page=page)
        return SearchMoviesResponse(**data)
    except grpc.RpcError as e:
        logger.error("gRPC Error no MovieService: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço interno de catálogo de filmes indisponível.",
        )


@app.get("/movies/discover", response_model=SearchMoviesResponse, summary="Explorar filmes por ID de gênero via gRPC")
def discover_movies_by_genre(
    genre_id: int = Query(..., ge=1, description="ID do gênero TMDb"),
    page: int = Query(default=1, ge=1, description="Página de resultados"),
):
    logger.info("Gateway GET /movies/discover -> Chamando MovieService gRPC: genre_id=%d, page=%d", genre_id, page)
    grpc_manager = get_grpc_manager()
    try:
        data = grpc_manager.discover_movies(genre_id=genre_id, page=page)
        return SearchMoviesResponse(**data)
    except grpc.RpcError as e:
        logger.error("gRPC Error no MovieService: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço interno de catálogo de filmes indisponível.",
        )


@app.get("/movies/now-playing", response_model=SearchMoviesResponse, summary="Filmes atualmente em cartaz nos cinemas via gRPC")
def get_now_playing_movies(
    page: int = Query(default=1, ge=1, description="Página de resultados"),
):
    logger.info("Gateway GET /movies/now-playing -> Chamando MovieService gRPC: page=%d", page)
    grpc_manager = get_grpc_manager()
    try:
        data = grpc_manager.get_now_playing_movies(page=page)
        return SearchMoviesResponse(**data)
    except Exception as e:
        logger.warning("gRPC indisponível para now-playing, usando fallback tmdb_service: %s", e)
        from criticbox_sd.server import tmdb_service
        data = tmdb_service.get_now_playing_movies(page=page)
        return SearchMoviesResponse(
            movies=data.get("results", []),
            page=data.get("page", 1),
            total_pages=data.get("total_pages", 1),
            total_results=data.get("total_results", 0),
        )


@app.get("/movies/genres", summary="Lista todos os gêneros disponíveis do catálogo")
def get_catalog_genres():
    from criticbox_sd.server.tmdb_service import get_genres

    genres = get_genres()
    return {"genres": genres}


@app.get("/movies/{tmdb_id}", response_model=MovieDetailsResponse, summary="Detalhes do filme ou série via gRPC")
def get_movie_details(
    tmdb_id: int = Path(..., ge=1, description="ID TMDb do filme"),
    type: str | None = Query(default=None, description="Tipo de mídia ('movie' ou 'tv')"),
):
    logger.info("Gateway GET /movies/%d (type: %s) -> Chamando MovieService gRPC", tmdb_id, type)
    grpc_manager = get_grpc_manager()
    try:
        details = grpc_manager.get_movie_details(tmdb_id, media_type=type or "")
        if not details:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Título não encontrado.")
        return MovieDetailsResponse(**details)
    except grpc.RpcError as e:
        logger.error("gRPC Error no MovieService: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço interno de catálogo de filmes indisponível.",
        )


from criticbox_sd.server import tmdb_service


@app.get("/movies/{tmdb_id}/season/{season_number}", summary="Episódios de uma temporada de série")
def get_season_episodes(
    tmdb_id: int = Path(..., ge=1, description="ID TMDb da série"),
    season_number: int = Path(..., ge=1, description="Número da temporada"),
):
    logger.info("Gateway GET /movies/%d/season/%d -> Buscando episódios", tmdb_id, season_number)
    episodes = tmdb_service.get_season_episodes(tmdb_id, season_number)
    return episodes


@app.get("/movies/{tmdb_id}/episodes", summary="Todos os episódios de todas as temporadas da série")
def get_all_episodes(
    tmdb_id: int = Path(..., ge=1, description="ID TMDb da série"),
):
    logger.info("Gateway GET /movies/%d/episodes -> Buscando todos os episódios de todas as temporadas", tmdb_id)
    return tmdb_service.get_all_series_episodes(tmdb_id)


# ----------------- Reviews Endpoints (gRPC ReviewService + JWT) ----------------- #
@app.post("/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED, summary="Criar nova crítica (Protegido por JWT)")
def create_review(
    payload: ReviewCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    # O user_id é obtido com segurança a partir do token JWT autenticado
    author_user_id = current_user["username"] if current_user.get("username") else current_user["user_id"]
    logger.info(
        "Gateway POST /reviews -> Despachando via gRPC: @%s | ID: %d (%s) | Nota: %.1f",
        author_user_id,
        payload.tmdb_id,
        payload.media_type,
        payload.rating,
    )
    grpc_manager = get_grpc_manager()
    try:
        res = grpc_manager.create_review(
            tmdb_id=payload.tmdb_id,
            user_id=author_user_id,
            rating=payload.rating,
            comment=payload.comment or "",
            contains_spoilers=payload.contains_spoilers,
            media_type=payload.media_type or "movie",
            season_number=payload.season_number,
            episode_number=payload.episode_number,
            movie_title=payload.movie_title or "",
        )
        if not res.get("success", False):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("message", "Erro ao registrar review"))
        return ReviewResponse(**res)
    except grpc.RpcError as e:
        logger.error("gRPC Error no ReviewService: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço interno de reviews indisponível.",
        )



@app.get("/reviews", response_model=list[ReviewListItem], summary="Listar todas as críticas via gRPC")
def list_reviews(limit: int = Query(default=50, ge=1, le=100)):
    logger.info("Gateway GET /reviews -> Chamando ReviewService gRPC (limit=%d)", limit)
    grpc_manager = get_grpc_manager()
    try:
        return grpc_manager.get_all_reviews(limit=limit)
    except grpc.RpcError as e:
        logger.error("gRPC Error no ReviewService: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço interno de reviews indisponível.",
        )


@app.get("/reviews/movie/{tmdb_id}", response_model=list[ReviewListItem], summary="Listar críticas de um filme via gRPC")
def list_movie_reviews(tmdb_id: int = Path(..., ge=1)):
    logger.info("Gateway GET /reviews/movie/%d -> Chamando ReviewService gRPC", tmdb_id)
    grpc_manager = get_grpc_manager()
    try:
        return grpc_manager.get_reviews_by_movie(tmdb_id)
    except grpc.RpcError as e:
        logger.error("gRPC Error no ReviewService: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço interno de reviews indisponível.",
        )


def start():
    uvicorn.run("criticbox_sd.api.main:app", host="0.0.0.0", port=int(os.getenv("API_PORT", "8000")), reload=True)


if __name__ == "__main__":
    start()
