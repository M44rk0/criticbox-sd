import logging
import os
import sys

import grpc
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from google.protobuf.json_format import MessageToDict

from criticbox_sd.generated import movie_pb2 as m_pb2
from criticbox_sd.generated import movie_pb2_grpc as m_pb2_grpc
from criticbox_sd.generated import review_pb2 as r_pb2
from criticbox_sd.generated import review_pb2_grpc as r_pb2_grpc
from criticbox_sd.generated import user_pb2 as u_pb2
from criticbox_sd.generated import user_pb2_grpc as u_pb2_grpc

load_dotenv()

logger = logging.getLogger("criticbox-gateway-grpc")

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
        "success": True,
        "message": "",
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
        user_target = f"{USER_HOST}:{USER_PORT}"
        movie_target = f"{MOVIE_HOST}:{MOVIE_PORT}"
        review_target = f"{REVIEW_HOST}:{REVIEW_PORT}"
        logger.info(
            "Inicializando canais gRPC: User -> %s | Movie -> %s | Review -> %s",
            user_target,
            movie_target,
            review_target,
        )

        self.user_channel = grpc.insecure_channel(user_target)
        self.user_stub = u_pb2_grpc.UserServiceStub(self.user_channel)

        self.movie_channel = grpc.insecure_channel(movie_target)
        self.movie_stub = m_pb2_grpc.MovieServiceStub(self.movie_channel)

        self.review_channel = grpc.insecure_channel(review_target)
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
        req = m_pb2.MovieDetailsRequest(tmdb_id=tmdb_id, media_type=media_type)
        res = self.movie_stub.GetMovieDetails(req, timeout=5.0)
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
    ) -> dict:
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
        )
        res = self.review_stub.CreateReview(req, timeout=10.0)
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
            "success": res.success,
            "message": res.message,
        }

    def get_all_reviews(self, limit: int = 50) -> list[dict]:
        req = r_pb2.GetAllReviewsRequest(limit=limit)
        res = self.review_stub.GetAllReviews(req, timeout=10.0)
        return [_pb_to_review_dict(r) for r in res.reviews]

    def get_reviews_by_movie(self, tmdb_id: int) -> list[dict]:
        req = r_pb2.MovieReviewsRequest(tmdb_id=tmdb_id)
        res = self.review_stub.GetReviewsByMovie(req, timeout=10.0)
        return [_pb_to_review_dict(r) for r in res.reviews]

    def get_reviews_by_user(self, user_id: str = "", username: str = "") -> list[dict]:
        req = r_pb2.UserReviewsRequest(user_id=user_id or username, username=username or user_id)
        res = self.review_stub.GetReviewsByUser(req, timeout=10.0)
        return [_pb_to_review_dict(r) for r in res.reviews]

    def get_season_episodes(self, tmdb_id: int, season_number: int) -> dict:
        req = m_pb2.SeasonEpisodesRequest(tmdb_id=tmdb_id, season_number=season_number)
        res = self.movie_stub.GetSeasonEpisodes(req, timeout=5.0)
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
        req = m_pb2.AllEpisodesRequest(tmdb_id=tmdb_id)
        res = self.movie_stub.GetAllEpisodes(req, timeout=8.0)
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
