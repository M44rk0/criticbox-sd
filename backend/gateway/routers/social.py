import logging

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from gateway.auth import get_current_user, get_optional_current_user
from gateway.grpc_clients import get_grpc_manager
from gateway.schemas.social import (
    FollowActionResponse,
    UpdateUserProfileRequest,
    UpdateUserProfileResponse,
    UserProfileResponse,
    UserSummaryItem,
)

logger = logging.getLogger("criticbox-gateway-social")

router = APIRouter(prefix="/users", tags=["Rede Social & Usuários"])


@router.put(
    "/profile",
    response_model=UpdateUserProfileResponse,
    summary="Atualizar perfil social do usuário autenticado (avatar e quatro pilares)",
)
def update_profile(
    body: UpdateUserProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    logger.info("Gateway PUT /users/profile para user_id=%s", user_id)
    grpc_manager = get_grpc_manager()
    res = grpc_manager.update_user_profile(
        user_id=user_id,
        avatar_url=body.avatar_url or "",
        four_pillars=body.four_pillars if body.four_pillars is not None else "",
    )
    if not res.get("success", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message", "Erro ao atualizar perfil."),
        )
    try:
        from gateway.routers.reviews import invalidate_avatar_cache

        invalidate_avatar_cache(current_user.get("username", ""), res.get("avatar_url", "") or body.avatar_url or "")
    except Exception as e:
        logger.warning("Falha ao invalidar cache de avatar: %s", e)
    return UpdateUserProfileResponse(**res)


@router.get(
    "/search",
    response_model=list[UserSummaryItem],
    summary="Buscar usuários por username para autocomplete ou rede social",
)
def search_users(
    q: str = Query(..., min_length=1, max_length=50, description="Termo de busca pelo @username"),
    limit: int = Query(default=10, ge=1, le=50, description="Limite de resultados"),
):
    logger.info("Gateway GET /users/search -> q='%s', limit=%d", q, limit)
    grpc_manager = get_grpc_manager()
    return grpc_manager.search_users(query=q, limit=limit)


@router.get(
    "/{username}/profile",
    response_model=UserProfileResponse,
    summary="Obter perfil social e métricas de relacionamento de um usuário",
)
def get_user_profile(
    username: str = Path(..., description="Nome de usuário ou UUID"),
    current_user: dict | None = Depends(get_optional_current_user),
):
    clean_username = username.lstrip("@").strip()
    viewer_id = current_user.get("user_id", "") if current_user else ""
    logger.info("Gateway GET /users/%s/profile (visualizador: %s)", clean_username, viewer_id or "anônimo")
    grpc_manager = get_grpc_manager()
    profile = grpc_manager.get_user_profile(username=clean_username, current_user_id=viewer_id)
    if not profile.get("success", False):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=profile.get("message", f"Usuário '{clean_username}' não encontrado."),
        )
    return UserProfileResponse(**profile)


@router.post(
    "/{target_id}/follow",
    response_model=FollowActionResponse,
    summary="Seguir um usuário (Protegido por JWT)",
)
def follow_user(
    target_id: str = Path(..., description="ID ou username do usuário a ser seguido"),
    current_user: dict = Depends(get_current_user),
):
    follower_id = current_user["user_id"]
    logger.info("Gateway POST /users/%s/follow por user_id=%s", target_id, follower_id)
    grpc_manager = get_grpc_manager()
    res = grpc_manager.follow_user(follower_id=follower_id, following_id=target_id)
    if not res.get("success", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message", "Erro ao seguir usuário."),
        )
    return FollowActionResponse(**res)


@router.delete(
    "/{target_id}/follow",
    response_model=FollowActionResponse,
    summary="Deixar de seguir um usuário (Protegido por JWT)",
)
def unfollow_user(
    target_id: str = Path(..., description="ID ou username do usuário a deixar de seguir"),
    current_user: dict = Depends(get_current_user),
):
    follower_id = current_user["user_id"]
    logger.info("Gateway DELETE /users/%s/follow por user_id=%s", target_id, follower_id)
    grpc_manager = get_grpc_manager()
    res = grpc_manager.unfollow_user(follower_id=follower_id, following_id=target_id)
    if not res.get("success", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message", "Erro ao deixar de seguir."),
        )
    return FollowActionResponse(**res)


@router.get(
    "/{username}/followers",
    response_model=list[UserSummaryItem],
    summary="Listar seguidores de um usuário",
)
def get_user_followers(username: str = Path(...)):
    grpc_manager = get_grpc_manager()
    return grpc_manager.get_user_followers(user_id=username)


@router.get(
    "/{username}/following",
    response_model=list[UserSummaryItem],
    summary="Listar quem o usuário segue",
)
def get_user_following(username: str = Path(...)):
    grpc_manager = get_grpc_manager()
    return grpc_manager.get_user_following(user_id=username)
