import logging

from fastapi import APIRouter, HTTPException, Path, Query, status
from fastapi.responses import JSONResponse

from gateway.grpc_clients import get_grpc_manager
from gateway.schemas.movies import MovieDetailsResponse, SearchMoviesResponse

logger = logging.getLogger("criticbox-gateway-movies")

router = APIRouter(prefix="/movies", tags=["Catálogo e Filmes"])


@router.get("", response_model=SearchMoviesResponse, summary="Busca filmes no catálogo TMDb via gRPC")
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
    data = grpc_manager.search_movies(query=q, page=page)
    return SearchMoviesResponse(**data)


@router.get("/trending", response_model=SearchMoviesResponse, summary="Filmes em alta via gRPC")
def get_trending_movies(
    time_window: str = Query(default="week", pattern="^(day|week)$", description="Janela de tempo: day ou week"),
    page: int = Query(default=1, ge=1, description="Página de resultados"),
):
    logger.info("Gateway GET /movies/trending -> Chamando MovieService gRPC (%s, %d)", time_window, page)
    grpc_manager = get_grpc_manager()
    data = grpc_manager.get_trending_movies(time_window=time_window, page=page)
    return SearchMoviesResponse(**data)


@router.get("/trending-tv", response_model=SearchMoviesResponse, summary="Séries em alta na semana via gRPC")
def get_trending_tv(
    time_window: str = Query(default="week", pattern="^(day|week)$", description="Janela de tempo: day ou week"),
    page: int = Query(default=1, ge=1, description="Página de resultados"),
):
    logger.info("Gateway GET /movies/trending-tv -> Chamando MovieService gRPC (%s, %d)", time_window, page)
    grpc_manager = get_grpc_manager()
    data = grpc_manager.get_trending_tv(time_window=time_window, page=page)
    return SearchMoviesResponse(**data)


@router.get(
    "/recommendations",
    response_model=SearchMoviesResponse,
    summary="Recomendações personalizadas para o usuário via gRPC",
)
def get_recommendations_for_user(
    user_id: str | None = Query(default=None, description="Username/ID do usuário para recomendações personalizadas"),
    page: int = Query(default=1, ge=1, description="Página de resultados"),
):
    logger.info(
        "Gateway GET /movies/recommendations -> Chamando MovieService gRPC (user_id=%s, page=%d)", user_id, page
    )
    grpc_manager = get_grpc_manager()
    data = grpc_manager.get_recommendations(user_id or "", page)
    return SearchMoviesResponse(**data)


@router.get(
    "/now-playing", response_model=SearchMoviesResponse, summary="Filmes atualmente em cartaz nos cinemas via gRPC"
)
def get_now_playing_movies(
    page: int = Query(default=1, ge=1, description="Página de resultados"),
):
    logger.info("Gateway GET /movies/now-playing -> Chamando MovieService gRPC: page=%d", page)
    grpc_manager = get_grpc_manager()
    data = grpc_manager.get_now_playing_movies(page=page)
    return SearchMoviesResponse(**data)


@router.get("/{tmdb_id}", response_model=MovieDetailsResponse, summary="Detalhes do filme ou série via gRPC")
def get_movie_details(
    tmdb_id: int = Path(..., ge=1, description="ID TMDb do filme"),
    type: str | None = Query(default=None, description="Tipo de mídia ('movie' ou 'tv')"),
):
    logger.info("Gateway GET /movies/%d (type: %s) -> Chamando MovieService gRPC", tmdb_id, type)
    grpc_manager = get_grpc_manager()
    details = grpc_manager.get_movie_details(tmdb_id, media_type=type or "")
    if not details:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Título não encontrado.")
    return MovieDetailsResponse(**details)


@router.get("/{tmdb_id}/season/{season_number}", summary="Episódios de uma temporada de série via gRPC")
def get_season_episodes(
    tmdb_id: int = Path(..., ge=1, description="ID TMDb da série"),
    season_number: int = Path(..., ge=1, description="Número da temporada"),
):
    logger.info("Gateway GET /movies/%d/season/%d -> Chamando MovieService gRPC", tmdb_id, season_number)
    grpc_manager = get_grpc_manager()
    return grpc_manager.get_season_episodes(tmdb_id, season_number)


@router.get("/{tmdb_id}/episodes", summary="Todos os episódios de todas as temporadas da série via gRPC")
def get_all_episodes(
    tmdb_id: int = Path(..., ge=1, description="ID TMDb da série"),
):
    logger.info("Gateway GET /movies/%d/episodes -> Chamando MovieService gRPC", tmdb_id)
    grpc_manager = get_grpc_manager()
    return grpc_manager.get_all_episodes(tmdb_id)
