import logging

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from gateway.auth import get_current_user
from gateway.grpc_clients import get_grpc_manager
from gateway.schemas.reviews import ReviewCreateRequest, ReviewListItem, ReviewResponse

logger = logging.getLogger("criticbox-gateway-reviews")

router = APIRouter(prefix="/reviews", tags=["Avaliações e Críticas"])


@router.post(
    "",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar nova crítica (Protegido por JWT)",
)
def create_review(
    payload: ReviewCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    author_user_id = current_user["user_id"]
    author_username = current_user.get("username", "")
    logger.info(
        "Gateway POST /reviews -> Despachando via gRPC: @%s (UUID: %s) | ID: %d (%s) | Nota: %.1f",
        author_username,
        author_user_id,
        payload.tmdb_id,
        payload.media_type,
        payload.rating,
    )
    grpc_manager = get_grpc_manager()
    res = grpc_manager.create_review(
        tmdb_id=payload.tmdb_id,
        user_id=author_user_id,
        username=author_username,
        rating=payload.rating,
        comment=payload.comment or "",
        contains_spoilers=payload.contains_spoilers,
        media_type=payload.media_type or "movie",
        season_number=payload.season_number,
        episode_number=payload.episode_number,
        movie_title=payload.movie_title or "",
        poster_url=payload.poster_url or "",
    )
    if not res.get("success", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message", "Erro ao registrar review"),
        )
    return ReviewResponse(**res)


@router.get("", response_model=list[ReviewListItem], summary="Listar todas as críticas via gRPC")
def list_reviews(limit: int = Query(default=50, ge=1, le=100)):
    logger.info("Gateway GET /reviews -> Chamando ReviewService gRPC (limit=%d)", limit)
    grpc_manager = get_grpc_manager()
    return grpc_manager.get_all_reviews(limit=limit)


@router.get("/movie/{tmdb_id}", response_model=list[ReviewListItem], summary="Listar críticas de um filme via gRPC")
def list_movie_reviews(tmdb_id: int = Path(..., ge=1)):
    logger.info("Gateway GET /reviews/movie/%d -> Chamando ReviewService gRPC", tmdb_id)
    grpc_manager = get_grpc_manager()
    return grpc_manager.get_reviews_by_movie(tmdb_id)


@router.get("/user/{user_id}", response_model=list[ReviewListItem], summary="Listar críticas de um usuário via gRPC")
def list_user_reviews(user_id: str = Path(...)):
    logger.info("Gateway GET /reviews/user/%s -> Chamando ReviewService gRPC", user_id)
    grpc_manager = get_grpc_manager()
    return grpc_manager.get_reviews_by_user(user_id=user_id, username=user_id)
