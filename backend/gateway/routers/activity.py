import logging

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from gateway.auth import get_current_user, get_optional_current_user
from gateway.grpc_clients import get_grpc_manager
from gateway.routers.helpers import resolve_canonical_media_metadata
from gateway.schemas.activity import (
    ActivityItemResponse,
    MediaStatusResponse,
    ToggleActivityRequest,
    ToggleActivityResponse,
)

logger = logging.getLogger("criticbox-gateway-activity")

router = APIRouter(prefix="/activity", tags=["Atividade do Usuário (Assistidos e Favoritos)"])


@router.post(
    "/watched/toggle",
    response_model=ToggleActivityResponse,
    summary="Alternar status de filme/série como assistido (Protegido por JWT)",
)
def toggle_watched(
    payload: ToggleActivityRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    username = current_user.get("username", "")
    grpc_manager = get_grpc_manager()

    official_title, official_poster, official_media_type = resolve_canonical_media_metadata(
        tmdb_id=payload.tmdb_id,
        media_type=payload.media_type or "",
        grpc_manager=grpc_manager,
        fallback_title=payload.movie_title or "",
        fallback_poster=payload.poster_url or "",
    )

    logger.info(
        "Gateway POST /activity/watched/toggle -> @%s (ID: %d, %s)",
        username,
        payload.tmdb_id,
        official_media_type,
    )

    res = grpc_manager.toggle_watched(
        tmdb_id=payload.tmdb_id,
        user_id=user_id,
        username=username,
        media_type=official_media_type,
        movie_title=official_title,
        poster_url=official_poster,
    )
    if not res.get("success", False) and "avaliação registrada" in res.get("message", "").lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message", "Este título possui uma avaliação registrada."),
        )

    return ToggleActivityResponse(**res)


@router.post(
    "/favorites/toggle",
    response_model=ToggleActivityResponse,
    summary="Alternar status de filme/série como favorito (Protegido por JWT)",
)
def toggle_favorite(
    payload: ToggleActivityRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    username = current_user.get("username", "")
    grpc_manager = get_grpc_manager()

    official_title, official_poster, official_media_type = resolve_canonical_media_metadata(
        tmdb_id=payload.tmdb_id,
        media_type=payload.media_type or "",
        grpc_manager=grpc_manager,
        fallback_title=payload.movie_title or "",
        fallback_poster=payload.poster_url or "",
    )

    logger.info(
        "Gateway POST /activity/favorites/toggle -> @%s (ID: %d, %s)",
        username,
        payload.tmdb_id,
        official_media_type,
    )

    res = grpc_manager.toggle_favorite(
        tmdb_id=payload.tmdb_id,
        user_id=user_id,
        username=username,
        media_type=official_media_type,
        movie_title=official_title,
        poster_url=official_poster,
    )
    return ToggleActivityResponse(**res)


@router.get(
    "/status/{tmdb_id}",
    response_model=MediaStatusResponse,
    summary="Obter status de interação (assistido, favorito, nota) para uma obra específica",
)
def get_media_status(
    tmdb_id: int = Path(..., ge=1, le=2_147_483_647, description="ID TMDb da obra"),
    media_type: str = Query(default="movie", description="Tipo de mídia (movie, tv, anime)"),
    current_user: dict | None = Depends(get_optional_current_user),
):
    user_id = current_user["user_id"] if current_user else ""
    username = current_user.get("username", "") if current_user else ""
    grpc_manager = get_grpc_manager()
    res = grpc_manager.get_media_status(
        tmdb_id=tmdb_id,
        user_id=user_id,
        username=username,
        media_type=media_type,
    )
    return MediaStatusResponse(**res)


@router.get(
    "/watched",
    response_model=list[ActivityItemResponse],
    summary="Listar obras assistidas pelo próprio usuário logado (Protegido por JWT)",
)
def list_my_watched(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    username = current_user.get("username", "")
    grpc_manager = get_grpc_manager()
    items = grpc_manager.get_user_watched(user_id=user_id, username=username)
    return [ActivityItemResponse(**it) for it in items]


@router.get(
    "/favorites",
    response_model=list[ActivityItemResponse],
    summary="Listar obras favoritas do próprio usuário logado (Protegido por JWT)",
)
def list_my_favorites(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    username = current_user.get("username", "")
    grpc_manager = get_grpc_manager()
    items = grpc_manager.get_user_favorites(user_id=user_id, username=username)
    return [ActivityItemResponse(**it) for it in items]


@router.get(
    "/user/{username}/watched",
    response_model=list[ActivityItemResponse],
    summary="Listar obras assistidas de um usuário específico (Público)",
)
def list_user_watched(username: str = Path(..., min_length=1, max_length=50)):
    grpc_manager = get_grpc_manager()
    items = grpc_manager.get_user_watched(user_id="", username=username)
    return [ActivityItemResponse(**it) for it in items]


@router.get(
    "/user/{username}/favorites",
    response_model=list[ActivityItemResponse],
    summary="Listar obras favoritas de um usuário específico (Público)",
)
def list_user_favorites(username: str = Path(..., min_length=1, max_length=50)):
    grpc_manager = get_grpc_manager()
    items = grpc_manager.get_user_favorites(user_id="", username=username)
    return [ActivityItemResponse(**it) for it in items]
