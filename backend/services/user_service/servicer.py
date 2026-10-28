import os
import sys
from concurrent import futures

import grpc
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from common.telemetry import configure_service_logger, traced_rpc
from generated import user_pb2 as u_pb2
from generated import user_pb2_grpc as u_pb2_grpc
from services.user_service import storage as database

load_dotenv()

logger = configure_service_logger("UserService")

PORT = int(os.getenv("USER_SERVICE_PORT", "50053"))


class UserServiceServicer(u_pb2_grpc.UserServiceServicer):
    def __init__(self):
        database.init_db()
        logger.info("Banco de dados isolado inicializado no UserService.")

    @traced_rpc()
    def RegisterUser(self, request, context):
        logger.info("RegisterUser -> Solicitado para username='%s'", request.username)
        res = database.create_user(request.username, request.password)
        logger.info(
            "RegisterUser -> Resultado para username='%s': %s",
            request.username,
            "Sucesso" if res["success"] else f"Falha ({res['message']})",
        )
        return u_pb2.RegisterUserResponse(
            success=res["success"],
            message=res["message"],
            user_id=res["user_id"],
            username=res["username"],
        )

    @traced_rpc()
    def AuthenticateUser(self, request, context):
        logger.info("AuthenticateUser -> Solicitado para username='%s'", request.username)
        res = database.authenticate_user(request.username, request.password)
        logger.info(
            "AuthenticateUser -> Resultado para username='%s': %s",
            request.username,
            "Sucesso" if res["success"] else f"Falha ({res['message']})",
        )
        return u_pb2.AuthenticateUserResponse(
            success=res["success"],
            message=res["message"],
            user_id=res["user_id"],
            username=res["username"],
        )

    @traced_rpc()
    def SearchUsers(self, request, context):
        logger.info("SearchUsers -> query='%s', limit=%d", request.query, request.limit)
        results = database.search_users(request.query, request.limit or 10)
        return u_pb2.SearchUsersResponse(
            users=[
                u_pb2.UserSummary(
                    user_id=u["user_id"],
                    username=u["username"],
                    created_at=u["created_at"],
                    avatar_url=u.get("avatar_url", ""),
                )
                for u in results
            ]
        )

    @traced_rpc()
    def FollowUser(self, request, context):
        logger.info("FollowUser -> follower='%s', following='%s'", request.follower_id, request.following_id)
        res = database.follow_user(request.follower_id, request.following_id)
        return u_pb2.FollowUserResponse(
            success=res["success"],
            message=res["message"],
            is_mutual=res.get("is_mutual", False),
        )

    @traced_rpc()
    def UnfollowUser(self, request, context):
        logger.info("UnfollowUser -> follower='%s', following='%s'", request.follower_id, request.following_id)
        res = database.unfollow_user(request.follower_id, request.following_id)
        return u_pb2.UnfollowUserResponse(
            success=res["success"],
            message=res["message"],
        )

    @traced_rpc()
    def GetUserProfile(self, request, context):
        logger.info("GetUserProfile -> username='%s', viewer='%s'", request.username, request.current_user_id)
        res = database.get_user_profile(request.username, request.current_user_id)
        return u_pb2.GetUserProfileResponse(
            success=res["success"],
            message=res["message"],
            user_id=res["user_id"],
            username=res["username"],
            created_at=res["created_at"],
            followers_count=res["followers_count"],
            following_count=res["following_count"],
            is_following=res["is_following"],
            is_followed_by=res["is_followed_by"],
            is_mutual=res["is_mutual"],
            avatar_url=res.get("avatar_url", ""),
            four_pillars=res.get("four_pillars", ""),
        )

    @traced_rpc()
    def UpdateUserProfile(self, request, context):
        logger.info("UpdateUserProfile -> user_id='%s'", request.user_id)
        res = database.update_user_profile(
            request.user_id,
            avatar_url=request.avatar_url,
            four_pillars=request.four_pillars,
        )
        return u_pb2.UpdateUserProfileResponse(
            success=res["success"],
            message=res["message"],
            avatar_url=res.get("avatar_url", ""),
            four_pillars=res.get("four_pillars", ""),
        )

    @traced_rpc()
    def GetUserFollows(self, request, context):
        follow_type = (request.follow_type or "followers").lower()
        logger.info("GetUserFollows -> user_id='%s', type='%s'", request.user_id, follow_type)
        if follow_type == "following":
            results = database.get_user_following(request.user_id)
        else:
            results = database.get_user_followers(request.user_id)
        return u_pb2.GetUserFollowsResponse(
            users=[
                u_pb2.UserSummary(
                    user_id=u["user_id"],
                    username=u["username"],
                    created_at=u["created_at"],
                    avatar_url=u.get("avatar_url", ""),
                )
                for u in results
            ]
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
