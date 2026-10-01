import logging

import grpc
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("criticbox-gateway")

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


async def grpc_exception_handler(request: Request, exc: grpc.RpcError):
    code = exc.code() if hasattr(exc, "code") else None
    details = exc.details() if hasattr(exc, "details") else str(exc)

    status_map = {
        grpc.StatusCode.NOT_FOUND: status.HTTP_404_NOT_FOUND,
        grpc.StatusCode.INVALID_ARGUMENT: status.HTTP_400_BAD_REQUEST,
        grpc.StatusCode.ALREADY_EXISTS: status.HTTP_409_CONFLICT,
        grpc.StatusCode.UNAUTHENTICATED: status.HTTP_401_UNAUTHORIZED,
        grpc.StatusCode.PERMISSION_DENIED: status.HTTP_403_FORBIDDEN,
        grpc.StatusCode.UNAVAILABLE: status.HTTP_503_SERVICE_UNAVAILABLE,
        grpc.StatusCode.DEADLINE_EXCEEDED: status.HTTP_504_GATEWAY_TIMEOUT,
    }

    http_status = status_map.get(code, status.HTTP_503_SERVICE_UNAVAILABLE)
    logger.error("gRPC Error interceptado no Gateway [%s]: %s -> HTTP %d", code, details, http_status)
    return JSONResponse(
        status_code=http_status,
        content={"detail": details or "Serviço interno indisponível."},
    )


def register_exception_handlers(app: FastAPI):
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(grpc.RpcError, grpc_exception_handler)
