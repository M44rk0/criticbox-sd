import logging
import os
import sys
from concurrent import futures

import grpc
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from generated import user_pb2 as u_pb2
from generated import user_pb2_grpc as u_pb2_grpc
from services.user_service import storage as database

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [UserService] %(message)s")
logger = logging.getLogger("UserService")

PORT = int(os.getenv("USER_SERVICE_PORT", "50053"))


class UserServiceServicer(u_pb2_grpc.UserServiceServicer):
    def __init__(self):
        database.init_db()
        logger.info("Banco de dados isolado inicializado no UserService.")

    def RegisterUser(self, request, context):
        logger.info("RegisterUser -> Solicitado para username='%s'", request.username)
        res = database.create_user(request.username, request.password)
        return u_pb2.RegisterUserResponse(
            success=res["success"],
            message=res["message"],
            user_id=res["user_id"],
            username=res["username"],
        )

    def AuthenticateUser(self, request, context):
        logger.info("AuthenticateUser -> Solicitado para username='%s'", request.username)
        res = database.authenticate_user(request.username, request.password)
        return u_pb2.AuthenticateUserResponse(
            success=res["success"],
            message=res["message"],
            user_id=res["user_id"],
            username=res["username"],
        )


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    u_pb2_grpc.add_UserServiceServicer_to_server(UserServiceServicer(), server)
    server_address = f"0.0.0.0:{PORT}"
    server.add_insecure_port(server_address)
    logger.info("Servidor gRPC UserService escutando em %s", server_address)
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
