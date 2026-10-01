import logging
import os
import signal
import sys
import time
from concurrent import futures

import grpc
import uvicorn
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

load_dotenv()

from criticbox_sd.api.main import app as gateway_app
from criticbox_sd.generated import movie_pb2_grpc as m_pb2_grpc
from criticbox_sd.generated import review_pb2_grpc as r_pb2_grpc
from criticbox_sd.generated import user_pb2_grpc as u_pb2_grpc
from criticbox_sd.server.movie_service import MovieServiceServicer
from criticbox_sd.server.review_service import ReviewServiceServicer
from criticbox_sd.server.user_service import UserServiceServicer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("CriticboxRunner")

USER_PORT = int(os.getenv("USER_SERVICE_PORT", "50053"))
MOVIE_PORT = int(os.getenv("MOVIE_SERVICE_PORT", "50051"))
REVIEW_PORT = int(os.getenv("REVIEW_SERVICE_PORT", "50052"))
GATEWAY_PORT = int(os.getenv("API_PORT", "8000"))


def start_user_service() -> grpc.Server:
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    u_pb2_grpc.add_UserServiceServicer_to_server(UserServiceServicer(), server)
    addr = f"0.0.0.0:{USER_PORT}"
    server.add_insecure_port(addr)
    server.start()
    logger.info("✓ [gRPC] UserService ativo na porta %d", USER_PORT)
    return server


def start_review_service() -> grpc.Server:
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    r_pb2_grpc.add_ReviewServiceServicer_to_server(ReviewServiceServicer(), server)
    addr = f"0.0.0.0:{REVIEW_PORT}"
    server.add_insecure_port(addr)
    server.start()
    logger.info("✓ [gRPC] ReviewService ativo na porta %d", REVIEW_PORT)
    return server


def start_movie_service() -> grpc.Server:
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    m_pb2_grpc.add_MovieServiceServicer_to_server(MovieServiceServicer(), server)
    addr = f"0.0.0.0:{MOVIE_PORT}"
    server.add_insecure_port(addr)
    server.start()
    logger.info("✓ [gRPC] MovieService ativo na porta %d", MOVIE_PORT)
    return server


import threading


def _warm_cache():
    """Pré-aquece o cache de dados populares em background para garantir carregamento instantâneo."""
    from criticbox_sd.server import tmdb as tmdb_service

    try:
        logger.info("Iniciando pré-aquecimento de cache em background...")
        tmdb_service.get_trending_movies(time_window="week", page=1)
        tmdb_service.get_now_playing_movies(page=1)
        tmdb_service.get_trending_tv(time_window="week", page=1)
        logger.info("✓ Cache pré-aquecido com sucesso (trending, now-playing, trending-tv)")
    except Exception as e:
        logger.warning("Aviso durante pré-aquecimento de cache: %s", e)


def main():
    logger.info("=" * 70)
    logger.info("INICIANDO ECOSSISTEMA DISTRIBUÍDO CRITICBOX (ENTREGA 2)")
    logger.info("=" * 70)

    # 1. Iniciar microsserviços gRPC
    user_srv = start_user_service()
    review_srv = start_review_service()
    movie_srv = start_movie_service()

    time.sleep(0.5)

    # 2. Pré-aquecer cache em background (não bloqueia inicialização)
    threading.Thread(target=_warm_cache, daemon=True, name="CacheWarmer").start()

    # 3. Iniciar API Gateway (FastAPI / Uvicorn)
    logger.info("✓ [REST] Iniciando API Gateway em http://0.0.0.0:%d", GATEWAY_PORT)
    logger.info("  -> Interface Web (Frontend): http://localhost:%d/app", GATEWAY_PORT)
    logger.info("  -> Documentação Swagger:   http://localhost:%d/docs", GATEWAY_PORT)
    logger.info("=" * 70)

    def shutdown(sig, frame):
        logger.info("\nEncerrando serviços distribuídos...")
        user_srv.stop(0)
        movie_srv.stop(0)
        review_srv.stop(0)
        logger.info("Servidores gRPC finalizados.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    uvicorn.run(gateway_app, host="0.0.0.0", port=GATEWAY_PORT, log_level="info")


if __name__ == "__main__":
    main()
