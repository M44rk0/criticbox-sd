import logging

from fastapi import APIRouter, Depends, HTTPException, status

from criticbox_sd.api.auth import create_access_token, get_current_user
from criticbox_sd.api.grpc_clients import get_grpc_manager
from criticbox_sd.api.schemas import (
    AuthResponse,
    UserLoginRequest,
    UserProfileResponse,
    UserRegisterRequest,
)

logger = logging.getLogger("criticbox-gateway-auth")

router = APIRouter(prefix="/auth", tags=["Autenticação"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registro de novo usuário",
)
def register_user(payload: UserRegisterRequest):
    logger.info("Gateway POST /auth/register -> Registrando @%s via gRPC", payload.username)
    grpc_manager = get_grpc_manager()
    res = grpc_manager.register_user(payload.username, payload.password)
    if not res["success"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res["message"])

    token = create_access_token(data={"sub": res["user_id"], "username": res["username"]})
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user_id=res["user_id"],
        username=res["username"],
        message=res["message"],
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Autenticação e geração de JWT",
)
def login_user(payload: UserLoginRequest):
    logger.info("Gateway POST /auth/login -> Autenticando @%s via gRPC", payload.username)
    grpc_manager = get_grpc_manager()
    res = grpc_manager.authenticate_user(payload.username, payload.password)
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


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Perfil do usuário autenticado",
)
def get_my_profile(current_user: dict = Depends(get_current_user)):
    return UserProfileResponse(
        user_id=current_user["user_id"],
        username=current_user["username"],
    )
