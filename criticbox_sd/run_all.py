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
from criticbox_sd.server.movie_service import MovieServiceServicer
from criticbox_sd.server.review_service import ReviewServiceServicer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("CriticboxRunner")

MOVIE_PORT = int(os.getenv("MOVIE_SERVICE_PORT", "50051"))
REVIEW_PORT = int(os.getenv("REVIEW_SERVICE_PORT", "50052"))
GATEWAY_PORT = int(os.getenv("API_PORT", "8000"))


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


def main():
    logger.info("=" * 70)
    logger.info("INICIANDO ECOSSISTEMA DISTRIBUÍDO CRITICBOX (ENTREGA 2)")
    logger.info("=" * 70)

    # 1. Iniciar microsserviços gRPC
    review_srv = start_review_service()
    movie_srv = start_movie_service()

    time.sleep(0.5)

    # 2. Iniciar API Gateway (FastAPI / Uvicorn)
    logger.info("✓ [REST] Iniciando API Gateway em http://0.0.0.0:%d", GATEWAY_PORT)
    logger.info("  -> Interface Web (Frontend): http://localhost:%d/app", GATEWAY_PORT)
    logger.info("  -> Documentação Swagger:   http://localhost:%d/docs", GATEWAY_PORT)
    logger.info("=" * 70)

    def shutdown(sig, frame):
        logger.info("\nEncerrando serviços distribuídos...")
        movie_srv.stop(0)
        review_srv.stop(0)
        logger.info("Servidores gRPC finalizados.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    uvicorn.run(gateway_app, host="0.0.0.0", port=GATEWAY_PORT, log_level="info")


if __name__ == "__main__":
    main()
