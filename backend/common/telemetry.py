import contextvars
import functools
import logging
import time
import uuid
from collections import namedtuple

import grpc

_request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")


def get_request_id() -> str:
    """Retorna o identificador de correlação (Request ID) atual no contexto."""
    return _request_id_ctx.get()


def set_request_id(req_id: str) -> None:
    """Define o identificador de correlação no contexto da requisição atual."""
    _request_id_ctx.set(req_id)


def generate_request_id() -> str:
    """Gera um identificador curto e único para rastreamento de requisições."""
    return uuid.uuid4().hex[:8]


class TraceLogFilter(logging.Filter):
    """Injeta %(request_id)s em todos os registros de log de forma transparente."""

    def filter(self, record: logging.LogRecord) -> bool:
        req_id = get_request_id()
        record.request_id = f"[{req_id}]" if req_id else "[-]"
        return True


def configure_service_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """Configura um logger padronizado com rastreabilidade via request_id."""
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Evita adicionar múltiplos handlers caso já tenha sido configurado
    if not any(isinstance(f, TraceLogFilter) for h in logger.handlers for f in h.filters):
        handler = logging.StreamHandler()
        handler.setLevel(level)
        formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] [%(name)s] %(request_id)s %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        handler.addFilter(TraceLogFilter())
        logger.addHandler(handler)
        logger.propagate = False

    return logger


class _ClientCallDetails(
    namedtuple("_ClientCallDetails", ("method", "timeout", "metadata", "credentials", "wait_for_ready")),
    grpc.ClientCallDetails,
):
    pass


class TraceClientInterceptor(grpc.UnaryUnaryClientInterceptor):
    """Interceptor gRPC cliente que propaga o x-request-id no cabeçalho metadata."""

    def intercept_unary_unary(self, continuation, client_call_details, request):
        req_id = get_request_id()
        if req_id:
            metadata = list(client_call_details.metadata or [])
            if not any(k.lower() == "x-request-id" for k, _ in metadata):
                metadata.append(("x-request-id", req_id))
            client_call_details = _ClientCallDetails(
                client_call_details.method,
                client_call_details.timeout,
                metadata,
                client_call_details.credentials,
                getattr(client_call_details, "wait_for_ready", None),
            )
        return continuation(client_call_details, request)


def extract_request_id_from_grpc_context(context) -> str:
    """Extrai x-request-id dos metadados da chamada gRPC ou gera um novo."""
    if context is not None and hasattr(context, "invocation_metadata"):
        try:
            for key, value in context.invocation_metadata() or []:
                if key.lower() == "x-request-id" and value:
                    return str(value)
        except Exception:
            pass
    return generate_request_id()


def traced_rpc(rpc_name: str | None = None):
    """Decorator para métodos de servicer gRPC com rastreabilidade e log de latência."""

    def decorator(func):
        name = rpc_name or func.__name__

        @functools.wraps(func)
        def wrapper(self, request, context):
            req_id = extract_request_id_from_grpc_context(context)
            set_request_id(req_id)
            t0 = time.perf_counter()
            logger = getattr(self, "logger", None) or logging.getLogger(self.__class__.__name__)

            logger.info("--> RPC %s iniciado", name)
            try:
                response = func(self, request, context)
                elapsed = (time.perf_counter() - t0) * 1000
                logger.info("<-- RPC %s concluído (%.1fms)", name, elapsed)
                return response
            except Exception as e:
                elapsed = (time.perf_counter() - t0) * 1000
                logger.error("<-- RPC %s falhou (%.1fms): %s", name, elapsed, e)
                raise

        return wrapper

    return decorator
