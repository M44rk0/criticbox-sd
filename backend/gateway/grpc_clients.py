import os
import sys

import grpc
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from google.protobuf.json_format import MessageToDict

from common.telemetry import TraceClientInterceptor, configure_service_logger
from generated import movie_pb2 as m_pb2
from generated import movie_pb2_grpc as m_pb2_grpc
from generated import review_pb2 as r_pb2
from generated import review_pb2_grpc as r_pb2_grpc
from generated import user_pb2 as u_pb2
from generated import user_pb2_grpc as u_pb2_grpc

load_dotenv()

logger = configure_service_logger("GatewayGRPC")

USER_HOST = os.getenv("USER_SERVICE_HOST", "localhost")
USER_PORT = os.getenv("USER_SERVICE_PORT", "50053")

MOVIE_HOST = os.getenv("MOVIE_SERVICE_HOST", "localhost")
MOVIE_PORT = os.getenv("MOVIE_SERVICE_PORT", "50051")

REVIEW_HOST = os.getenv("REVIEW_SERVICE_HOST", "localhost")
REVIEW_PORT = os.getenv("REVIEW_SERVICE_PORT", "50052")


def _pb_to_movie_dict(m) -> dict:
    return {
        "tmdb_id": m.tmdb_id,
        "title": m.title,
        "release_date": m.release_date,
        "poster_url": m.poster_url,
        "backdrop_url": m.backdrop_url,
        "overview": m.overview,
        "tmdb_vote_average": round(float(m.tmdb_vote_average), 1),
        "criticbox_rating": round(float(m.criticbox_rating), 1),
        "criticbox_review_count": m.criticbox_review_count,
        "media_type": getattr(m, "media_type", "movie") or "movie",
    }


def _pb_to_review_dict(r) -> dict:
    return {
        "review_id": r.review_id,
        "tmdb_id": r.tmdb_id,
        "movie_title": getattr(r, "movie_title", "") or "",
        "user_id": r.user_id,
        "username": getattr(r, "username", "") or r.user_id,
        "rating": round(float(r.rating), 1),
        "comment": r.comment,
        "contains_spoilers": r.contains_spoilers,
        "created_at": r.created_at,
        "media_type": getattr(r, "media_type", "movie") or "movie",
        "season_number": r.season_number if getattr(r, "season_number", 0) > 0 else None,
        "episode_number": r.episode_number if getattr(r, "episode_number", 0) > 0 else None,
        "poster_url": getattr(r, "poster_url", "") or "",
        "custom_rating": getattr(r, "custom_rating", 0) or 0,
        "watched_with": getattr(r, "watched_with", "") or "",
        "viewing_venue": getattr(r, "viewing_venue", "") or "",
        "success": True,
        "message": "",
    }


def _pb_to_activity_dict(item) -> dict:
    return {
        "id": item.id,
        "tmdb_id": item.tmdb_id,
        "user_id": item.user_id,
        "username": getattr(item, "username", "") or item.user_id,
        "media_type": getattr(item, "media_type", "movie") or "movie",
        "movie_title": getattr(item, "movie_title", "") or "",
        "poster_url": getattr(item, "poster_url", "") or "",
        "created_at": item.created_at,
        "user_rating": round(float(item.user_rating), 1) if getattr(item, "user_rating", 0.0) > 0 else None,
        "has_review": bool(getattr(item, "has_review", False)),
        "review_id": getattr(item, "review_id", "") or "",
    }


class GatewayGRPCManager:
    _instance = None

    def __init__(self):
        self.user_channel = None
        self.user_stub = None
        self.movie_channel = None
        self.movie_stub = None
        self.review_channel = None
        self.review_stub = None
        self._init_channels()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _init_channels(self):
        user_host = os.getenv("USER_SERVICE_HOST", USER_HOST)
        user_port = os.getenv("USER_SERVICE_PORT", USER_PORT)
        movie_host = os.getenv("MOVIE_SERVICE_HOST", MOVIE_HOST)
        movie_port = os.getenv("MOVIE_SERVICE_PORT", MOVIE_PORT)
        review_host = os.getenv("REVIEW_SERVICE_HOST", REVIEW_HOST)
        review_port = os.getenv("REVIEW_SERVICE_PORT", REVIEW_PORT)

        user_target = f"{user_host}:{user_port}"
        movie_target = f"{movie_host}:{movie_port}"
        review_target = f"{review_host}:{review_port}"
        logger.info(
            "Inicializando canais gRPC: User -> %s | Movie -> %s | Review -> %s",
            user_target,
            movie_target,
            review_target,
        )

        trace_interceptor = TraceClientInterceptor()
        self.user_channel = grpc.intercept_channel(grpc.insecure_channel(user_target), trace_interceptor)
        self.user_stub = u_pb2_grpc.UserServiceStub(self.user_channel)

        self.movie_channel = grpc.intercept_channel(grpc.insecure_channel(movie_target), trace_interceptor)
        self.movie_stub = m_pb2_grpc.MovieServiceStub(self.movie_channel)

        self.review_channel = grpc.intercept_channel(grpc.insecure_channel(review_target), trace_interceptor)
        self.review_stub = r_pb2_grpc.ReviewServiceStub(self.review_channel)

    def close_channels(self):
        if self.user_channel:
            self.user_channel.close()
        if self.movie_channel:
            self.movie_channel.close()
        if self.review_channel:
            self.review_channel.close()

    def search_movies(self, query: str, page: int = 1) -> dict:
        req = m_pb2.SearchMoviesRequest(query=query, page=page)
        res = self.movie_stub.SearchMovies(req, timeout=5.0)
        return {
            "page": res.page,
            "total_results": res.total_results,
            "total_pages": res.total_pages or 1,
            "movies": [_pb_to_movie_dict(m) for m in res.movies],
        }

    def get_trending_movies(self, time_window: str = "week", page: int = 1) -> dict:
        req = m_pb2.TrendingMoviesRequest(time_window=time_window, page=page)
        res = self.movie_stub.GetTrendingMovies(req, timeout=5.0)
        return {
            "page": res.page,
            "total_results": res.total_results,
            "total_pages": res.total_pages or 1,
            "movies": [_pb_to_movie_dict(m) for m in res.movies],
        }

    def get_trending_tv(self, time_window: str = "week", page: int = 1) -> dict:
        req = m_pb2.TrendingMoviesRequest(time_window=time_window, page=page)
        res = self.movie_stub.GetTrendingTV(req, timeout=5.0)
        return {
            "page": res.page,
            "total_results": res.total_results,
            "total_pages": res.total_pages or 1,
            "movies": [_pb_to_movie_dict(m) for m in res.movies],
        }

    def get_recommendations(self, user_id: str = "", page: int = 1) -> dict:
        req = m_pb2.RecommendationsRequest(user_id=user_id, page=page)
        res = self.movie_stub.GetRecommendations(req, timeout=5.0)
        return {
            "page": res.page,
            "total_results": res.total_results,
            "total_pages": res.total_pages or 1,
            "movies": [_pb_to_movie_dict(m) for m in res.movies],
        }

    def get_now_playing_movies(self, page: int = 1) -> dict:
        req = m_pb2.NowPlayingRequest(page=page)
        res = self.movie_stub.GetNowPlayingMovies(req, timeout=5.0)
        return {
            "page": res.page,
            "total_results": res.total_results,
            "total_pages": res.total_pages or 1,
            "movies": [_pb_to_movie_dict(m) for m in res.movies],
        }

    def get_movie_details(self, tmdb_id: int, media_type: str = "") -> dict | None:
        if tmdb_id <= 0 or tmdb_id > 2_147_483_647:
            return None
        try:
            req = m_pb2.MovieDetailsRequest(tmdb_id=tmdb_id, media_type=media_type)
            res = self.movie_stub.GetMovieDetails(req, timeout=5.0)
        except (ValueError, OverflowError):
            return None
        if not res.found:
            return None

        data = MessageToDict(
            res,
            preserving_proto_field_name=True,
            always_print_fields_with_no_presence=True,
        )
        data["tmdb_vote_average"] = round(float(data.get("tmdb_vote_average", 0.0)), 1)
        data["criticbox_rating"] = round(float(data.get("criticbox_rating", 0.0)), 1)
        data["popularity"] = round(float(data.get("popularity", 0.0)), 1)

        last_ep = data.get("last_episode_to_air")
        if not last_ep or not last_ep.get("name"):
            data["last_episode_to_air"] = None
        else:
            last_ep["vote_average"] = round(float(last_ep.get("vote_average", 0.0)), 1)

        next_ep = data.get("next_episode_to_air")
        if not next_ep or not next_ep.get("name"):
            data["next_episode_to_air"] = None
        else:
            next_ep["vote_average"] = round(float(next_ep.get("vote_average", 0.0)), 1)

        return data

    def register_user(self, username: str, password: str) -> dict:
        req = u_pb2.RegisterUserRequest(username=username, password=password)
        res = self.user_stub.RegisterUser(req, timeout=5.0)
        return {
            "success": res.success,
            "message": res.message,
            "user_id": res.user_id,
            "username": res.username,
        }

    def authenticate_user(self, username: str, password: str) -> dict:
        req = u_pb2.AuthenticateUserRequest(username=username, password=password)
        res = self.user_stub.AuthenticateUser(req, timeout=5.0)
        return {
            "success": res.success,
            "message": res.message,
            "user_id": res.user_id,
            "username": res.username,
        }

    @staticmethod
    def _map_user_summary(u) -> dict:
        return {
            "user_id": u.user_id,
            "username": u.username,
            "created_at": u.created_at,
            "avatar_url": getattr(u, "avatar_url", "") or "",
        }

    def search_users(self, query: str, limit: int = 10) -> list[dict]:
        req = u_pb2.SearchUsersRequest(query=query, limit=limit)
        res = self.user_stub.SearchUsers(req, timeout=5.0)
        return [self._map_user_summary(u) for u in res.users]

    def follow_user(self, follower_id: str, following_id: str) -> dict:
        req = u_pb2.FollowUserRequest(follower_id=follower_id, following_id=following_id)
        res = self.user_stub.FollowUser(req, timeout=5.0)
        return {
            "success": res.success,
            "message": res.message,
            "is_mutual": res.is_mutual,
        }

    def unfollow_user(self, follower_id: str, following_id: str) -> dict:
        req = u_pb2.UnfollowUserRequest(follower_id=follower_id, following_id=following_id)
        res = self.user_stub.UnfollowUser(req, timeout=5.0)
        return {
            "success": res.success,
            "message": res.message,
        }

    def get_user_profile(self, username: str, current_user_id: str = "") -> dict:
        req = u_pb2.GetUserProfileRequest(username=username, current_user_id=current_user_id)
        res = self.user_stub.GetUserProfile(req, timeout=5.0)
        return {
            "success": res.success,
            "message": res.message,
            "user_id": res.user_id,
            "username": res.username,
            "created_at": res.created_at,
            "followers_count": res.followers_count,
            "following_count": res.following_count,
            "is_following": res.is_following,
            "is_followed_by": res.is_followed_by,
            "is_mutual": res.is_mutual,
            "avatar_url": getattr(res, "avatar_url", "") or "",
            "four_pillars": getattr(res, "four_pillars", "") or "",
        }

    def update_user_profile(self, user_id: str, avatar_url: str = "", four_pillars: str = "") -> dict:
        req = u_pb2.UpdateUserProfileRequest(user_id=user_id, avatar_url=avatar_url, four_pillars=four_pillars)
        res = self.user_stub.UpdateUserProfile(req, timeout=5.0)
        return {
            "success": res.success,
            "message": res.message,
            "avatar_url": getattr(res, "avatar_url", "") or "",
            "four_pillars": getattr(res, "four_pillars", "") or "",
        }

    def get_user_followers(self, user_id: str) -> list[dict]:
        req = u_pb2.GetUserFollowsRequest(user_id=user_id, follow_type="followers")
        res = self.user_stub.GetUserFollows(req, timeout=5.0)
        return [self._map_user_summary(u) for u in res.users]

    def get_user_following(self, user_id: str) -> list[dict]:
        req = u_pb2.GetUserFollowsRequest(user_id=user_id, follow_type="following")
        res = self.user_stub.GetUserFollows(req, timeout=5.0)
        return [self._map_user_summary(u) for u in res.users]

    def create_review(
        self,
        tmdb_id: int,
        user_id: str,
        rating: float,
        comment: str,
        contains_spoilers: bool,
        media_type: str = "movie",
        season_number: int | None = None,
        episode_number: int | None = None,
        movie_title: str = "",
        poster_url: str = "",
        username: str = "",
        custom_rating: int | None = None,
        watched_with: str = "",
        viewing_venue: str = "",
    ) -> dict:
        if tmdb_id <= 0 or tmdb_id > 2_147_483_647:
            return {"success": False, "message": "ID do filme fora do intervalo permitido."}
        try:
            req = r_pb2.CreateReviewRequest(
                tmdb_id=tmdb_id,
                user_id=user_id,
                rating=rating,
                comment=comment,
                contains_spoilers=contains_spoilers,
                media_type=media_type or "movie",
                season_number=season_number or 0,
                episode_number=episode_number or 0,
                movie_title=movie_title or "",
                poster_url=poster_url or "",
                username=username or user_id,
                custom_rating=custom_rating or 0,
                watched_with=watched_with or "",
                viewing_venue=viewing_venue or "",
            )
            res = self.review_stub.CreateReview(req, timeout=10.0)
        except (ValueError, OverflowError) as e:
            return {"success": False, "message": f"Dados inválidos: {e}"}
        return {
            "review_id": res.review_id,
            "tmdb_id": res.tmdb_id,
            "movie_title": getattr(res, "movie_title", "") or movie_title,
            "user_id": res.user_id,
            "username": getattr(res, "username", "") or username or res.user_id,
            "rating": round(float(res.rating), 1),
            "comment": res.comment,
            "contains_spoilers": res.contains_spoilers,
            "created_at": res.created_at,
            "media_type": getattr(res, "media_type", "movie") or "movie",
            "season_number": res.season_number if res.season_number > 0 else None,
            "episode_number": res.episode_number if res.episode_number > 0 else None,
            "poster_url": getattr(res, "poster_url", "") or poster_url,
            "custom_rating": getattr(res, "custom_rating", 0) or 0,
            "watched_with": getattr(res, "watched_with", "") or "",
            "viewing_venue": getattr(res, "viewing_venue", "") or "",
            "success": res.success,
            "message": res.message,
        }

    def get_all_reviews(self, limit: int = 50) -> list[dict]:
        req = r_pb2.GetAllReviewsRequest(limit=limit)
        res = self.review_stub.GetAllReviews(req, timeout=10.0)
        return [_pb_to_review_dict(r) for r in res.reviews]

    def get_reviews_by_movie(self, tmdb_id: int) -> list[dict]:
        if tmdb_id <= 0 or tmdb_id > 2_147_483_647:
            return []
        try:
            req = r_pb2.MovieReviewsRequest(tmdb_id=tmdb_id)
            res = self.review_stub.GetReviewsByMovie(req, timeout=10.0)
        except (ValueError, OverflowError):
            return []
        return [_pb_to_review_dict(r) for r in res.reviews]

    def get_reviews_by_user(self, user_id: str = "", username: str = "") -> list[dict]:
        req = r_pb2.UserReviewsRequest(user_id=user_id or username, username=username or user_id)
        res = self.review_stub.GetReviewsByUser(req, timeout=10.0)
        return [_pb_to_review_dict(r) for r in res.reviews]

    def delete_review(self, review_id: str, user_id: str, username: str = "") -> dict:
        req = r_pb2.DeleteReviewRequest(
            review_id=review_id,
            user_id=user_id,
            username=username or user_id,
        )
        res = self.review_stub.DeleteReview(req, timeout=10.0)
        return {
            "success": res.success,
            "message": res.message,
        }

    def toggle_watched(
        self,
        tmdb_id: int,
        user_id: str,
        username: str = "",
        media_type: str = "movie",
        movie_title: str = "",
        poster_url: str = "",
    ) -> dict:
        if tmdb_id <= 0 or tmdb_id > 2_147_483_647:
            return {"success": False, "message": "ID TMDb inválido", "active": False}
        req = r_pb2.ToggleActivityRequest(
            tmdb_id=tmdb_id,
            user_id=user_id,
            username=username or user_id,
            media_type=media_type or "movie",
            movie_title=movie_title or "",
            poster_url=poster_url or "",
        )
        res = self.review_stub.ToggleWatched(req, timeout=10.0)
        return {"success": res.success, "message": res.message, "active": res.active}

    def toggle_favorite(
        self,
        tmdb_id: int,
        user_id: str,
        username: str = "",
        media_type: str = "movie",
        movie_title: str = "",
        poster_url: str = "",
    ) -> dict:
        if tmdb_id <= 0 or tmdb_id > 2_147_483_647:
            return {"success": False, "message": "ID TMDb inválido", "active": False}
        req = r_pb2.ToggleActivityRequest(
            tmdb_id=tmdb_id,
            user_id=user_id,
            username=username or user_id,
            media_type=media_type or "movie",
            movie_title=movie_title or "",
            poster_url=poster_url or "",
        )
        res = self.review_stub.ToggleFavorite(req, timeout=10.0)
        return {"success": res.success, "message": res.message, "active": res.active}

    def get_user_watched(self, user_id: str = "", username: str = "") -> list[dict]:
        req = r_pb2.UserActivityListRequest(user_id=user_id or username, username=username or user_id)
        res = self.review_stub.GetUserWatched(req, timeout=10.0)
        return [_pb_to_activity_dict(it) for it in res.items]

    def get_user_favorites(self, user_id: str = "", username: str = "") -> list[dict]:
        req = r_pb2.UserActivityListRequest(user_id=user_id or username, username=username or user_id)
        res = self.review_stub.GetUserFavorites(req, timeout=10.0)
        return [_pb_to_activity_dict(it) for it in res.items]

    def get_media_status(self, tmdb_id: int, user_id: str = "", username: str = "", media_type: str = "movie") -> dict:
        if tmdb_id <= 0 or tmdb_id > 2_147_483_647:
            return {
                "tmdb_id": tmdb_id,
                "media_type": media_type,
                "is_watched": False,
                "is_favorite": False,
                "has_review": False,
                "user_rating": None,
                "review_id": "",
            }
        req = r_pb2.MediaStatusRequest(
            tmdb_id=tmdb_id,
            user_id=user_id or username,
            username=username or user_id,
            media_type=media_type or "movie",
        )
        res = self.review_stub.GetMediaStatus(req, timeout=10.0)
        return {
            "tmdb_id": res.tmdb_id,
            "media_type": media_type,
            "is_watched": res.is_watched,
            "is_favorite": res.is_favorite,
            "has_review": res.has_review,
            "user_rating": round(float(res.user_rating), 1) if res.user_rating > 0 else None,
            "review_id": res.review_id,
        }

    def get_season_episodes(self, tmdb_id: int, season_number: int) -> dict:
        if tmdb_id <= 0 or tmdb_id > 2_147_483_647 or season_number <= 0 or season_number > 2_147_483_647:
            return {"episodes": []}
        try:
            req = m_pb2.SeasonEpisodesRequest(tmdb_id=tmdb_id, season_number=season_number)
            res = self.movie_stub.GetSeasonEpisodes(req, timeout=5.0)
        except (ValueError, OverflowError):
            return {"episodes": []}
        return {
            "episodes": [
                {
                    "episode_number": e.episode_number,
                    "season_number": e.season_number,
                    "name": e.name,
                    "air_date": e.air_date,
                    "overview": e.overview,
                    "still_url": e.still_url,
                    "vote_average": round(float(e.vote_average), 1),
                }
                for e in res.episodes
            ]
        }

    def get_all_episodes(self, tmdb_id: int) -> dict:
        if tmdb_id <= 0 or tmdb_id > 2_147_483_647:
            return {}
        try:
            req = m_pb2.AllEpisodesRequest(tmdb_id=tmdb_id)
            res = self.movie_stub.GetAllEpisodes(req, timeout=8.0)
        except (ValueError, OverflowError):
            return {}
        return {
            str(k): [
                {
                    "episode_number": e.episode_number,
                    "season_number": e.season_number,
                    "name": e.name,
                    "air_date": e.air_date,
                    "overview": e.overview,
                    "still_url": e.still_url,
                    "vote_average": round(float(e.vote_average), 1),
                }
                for e in v.episodes
            ]
            for k, v in res.seasons.items()
        }


def get_grpc_manager() -> GatewayGRPCManager:
    return GatewayGRPCManager.get_instance()
