import logging

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from gateway.auth import get_current_user
from gateway.grpc_clients import get_grpc_manager
from gateway.schemas.reviews import (
    ReviewCreateRequest,
    ReviewDeleteResponse,
    ReviewListItem,
    ReviewResponse,
)

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
    grpc_manager = get_grpc_manager()

    # Consulta os metadados oficiais no MovieService via gRPC
    # para que ninguém possa enviar títulos, posters ou tipos arbitrários
    movie_details = None
    try:
        movie_details = grpc_manager.get_movie_details(payload.tmdb_id, media_type=payload.media_type or "")
    except Exception as e:
        logger.warning("Falha ao consultar MovieService para tmdb_id=%d: %s", payload.tmdb_id, e)

    if movie_details:
        official_title = movie_details.get("title") or ""
        official_poster = movie_details.get("poster_url") or ""
        official_media_type = movie_details.get("media_type") or (payload.media_type or "movie")
    else:
        official_title = ""
        official_poster = ""
        official_media_type = payload.media_type or "movie"

    logger.info(
        "Gateway POST /reviews -> Despachando via gRPC: @%s (UUID: %s) | ID: %d (%s - '%s') | Nota: %.1f",
        author_username,
        author_user_id,
        payload.tmdb_id,
        official_media_type,
        official_title,
        payload.rating,
    )

    res = grpc_manager.create_review(
        tmdb_id=payload.tmdb_id,
        user_id=author_user_id,
        username=author_username,
        rating=payload.rating,
        comment=payload.comment or "",
        contains_spoilers=payload.contains_spoilers,
        media_type=official_media_type,
        season_number=payload.season_number,
        episode_number=payload.episode_number,
        movie_title=official_title,
        poster_url=official_poster,
    )
    if not res.get("success", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message", "Erro ao registrar review"),
        )
    return ReviewResponse(**res)


@router.get("/me", response_model=list[ReviewListItem], summary="Listar críticas do próprio usuário logado (Protegido por JWT)")
def list_my_reviews(current_user: dict = Depends(get_current_user)):
    author_user_id = current_user["user_id"]
    author_username = current_user.get("username", "")
    logger.info("Gateway GET /reviews/me -> Buscando reviews de @%s (id=%s)", author_username, author_user_id)
    grpc_manager = get_grpc_manager()
    return grpc_manager.get_reviews_by_user(user_id=author_user_id, username=author_username)


@router.get("", response_model=list[ReviewListItem], summary="Listar todas as críticas via gRPC")
def list_reviews(limit: int = Query(default=50, ge=1, le=100)):
    logger.info("Gateway GET /reviews -> Chamando ReviewService gRPC (limit=%d)", limit)
    grpc_manager = get_grpc_manager()
    return grpc_manager.get_all_reviews(limit=limit)


@router.get("/movie/{tmdb_id}", response_model=list[ReviewListItem], summary="Listar críticas de um filme via gRPC")
def list_movie_reviews(tmdb_id: int = Path(..., ge=1, le=2_147_483_647, description="ID TMDb do filme")):
    logger.info("Gateway GET /reviews/movie/%d -> Chamando ReviewService gRPC", tmdb_id)
    grpc_manager = get_grpc_manager()
    return grpc_manager.get_reviews_by_movie(tmdb_id)


@router.get("/user/{user_id}", response_model=list[ReviewListItem], summary="Listar críticas de um usuário via gRPC")
def list_user_reviews(user_id: str = Path(...)):
    logger.info("Gateway GET /reviews/user/%s -> Chamando ReviewService gRPC", user_id)
    grpc_manager = get_grpc_manager()
    return grpc_manager.get_reviews_by_user(user_id=user_id, username=user_id)


@router.delete(
    "/{review_id}",
    response_model=ReviewDeleteResponse,
    summary="Remover a própria avaliação (Protegido por JWT)",
)
def delete_review(
    review_id: str = Path(..., description="ID da avaliação a remover"),
    current_user: dict = Depends(get_current_user),
):
    author_user_id = current_user["user_id"]
    author_username = current_user.get("username", "")
    logger.info(
        "Gateway DELETE /reviews/%s -> Usuário @%s (UUID: %s)",
        review_id,
        author_username,
        author_user_id,
    )
    grpc_manager = get_grpc_manager()
    res = grpc_manager.delete_review(
        review_id=review_id,
        user_id=author_user_id,
        username=author_username,
    )
    if not res.get("success", False):
        msg = res.get("message", "Erro ao remover avaliação.")
        if "não encontrada" in msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)

    return ReviewDeleteResponse(success=True, message=res.get("message", "Avaliação removida com sucesso."))

