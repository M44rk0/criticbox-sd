import logging
import os
import sys

import grpc
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from criticbox_sd.generated import movie_pb2 as m_pb2
from criticbox_sd.generated import movie_pb2_grpc as m_pb2_grpc
from criticbox_sd.generated import review_pb2 as r_pb2
from criticbox_sd.generated import review_pb2_grpc as r_pb2_grpc

load_dotenv()

logger = logging.getLogger("criticbox-gateway-grpc")

MOVIE_HOST = os.getenv("MOVIE_SERVICE_HOST", "localhost")
MOVIE_PORT = os.getenv("MOVIE_SERVICE_PORT", "50051")

REVIEW_HOST = os.getenv("REVIEW_SERVICE_HOST", "localhost")
REVIEW_PORT = os.getenv("REVIEW_SERVICE_PORT", "50052")


class GatewayGRPCManager:
    _instance = None

    def __init__(self):
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
        movie_target = f"{MOVIE_HOST}:{MOVIE_PORT}"
        review_target = f"{REVIEW_HOST}:{REVIEW_PORT}"
        logger.info("Inicializando canais gRPC: Movie -> %s | Review -> %s", movie_target, review_target)

        self.movie_channel = grpc.insecure_channel(movie_target)
        self.movie_stub = m_pb2_grpc.MovieServiceStub(self.movie_channel)

        self.review_channel = grpc.insecure_channel(review_target)
        self.review_stub = r_pb2_grpc.ReviewServiceStub(self.review_channel)

    # ----------------- Movie Service Operations ----------------- #
    def search_movies(self, query: str, page: int = 1) -> dict:
        req = m_pb2.SearchMoviesRequest(query=query, page=page)
        res = self.movie_stub.SearchMovies(req, timeout=5.0)
        return {
            "page": res.page,
            "total_results": res.total_results,
            "total_pages": res.total_pages or 1,
            "movies": [
                {
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
                for m in res.movies
            ],
        }

    def get_trending_movies(self, time_window: str = "week", page: int = 1) -> dict:
        req = m_pb2.TrendingMoviesRequest(time_window=time_window, page=page)
        res = self.movie_stub.GetTrendingMovies(req, timeout=5.0)
        return {
            "page": res.page,
            "total_results": res.total_results,
            "total_pages": res.total_pages or 1,
            "movies": [
                {
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
                for m in res.movies
            ],
        }

    def discover_movies(self, genre_id: int, page: int = 1) -> dict:
        req = m_pb2.DiscoverMoviesRequest(genre_id=genre_id, page=page)
        res = self.movie_stub.DiscoverMovies(req, timeout=5.0)
        return {
            "page": res.page,
            "total_results": res.total_results,
            "total_pages": res.total_pages or 1,
            "movies": [
                {
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
                for m in res.movies
            ],
        }

    def get_now_playing_movies(self, page: int = 1) -> dict:
        req = m_pb2.NowPlayingRequest(page=page)
        res = self.movie_stub.GetNowPlayingMovies(req, timeout=5.0)
        return {
            "page": res.page,
            "total_results": res.total_results,
            "total_pages": res.total_pages or 1,
            "movies": [
                {
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
                for m in res.movies
            ],
        }

    def get_movie_details(self, tmdb_id: int, media_type: str = "") -> dict | None:
        req = m_pb2.MovieDetailsRequest(tmdb_id=tmdb_id, media_type=media_type)
        res = self.movie_stub.GetMovieDetails(req, timeout=5.0)
        if not res.found:
            return None
        return {
            "tmdb_id": res.tmdb_id,
            "title": res.title,
            "release_date": res.release_date,
            "poster_url": res.poster_url,
            "backdrop_url": res.backdrop_url,
            "overview": res.overview,
            "tmdb_vote_average": round(float(res.tmdb_vote_average), 1),
            "criticbox_rating": round(float(res.criticbox_rating), 1),
            "criticbox_review_count": res.criticbox_review_count,
            "genres": list(res.genres),
            "runtime": res.runtime,
            "directors": list(res.directors),
            "cast": [
                {
                    "name": c.name,
                    "character": c.character,
                    "profile_url": c.profile_url,
                }
                for c in res.cast
            ],
            "trailer_url": res.trailer_url,
            "tagline": res.tagline,
            "media_type": getattr(res, "media_type", "movie") or "movie",
            "number_of_seasons": getattr(res, "number_of_seasons", 0),
            "number_of_episodes": getattr(res, "number_of_episodes", 0),
            "seasons": [
                {
                    "season_number": s.season_number,
                    "name": s.name,
                    "episode_count": s.episode_count,
                    "poster_url": getattr(s, "poster_url", "") or "",
                }
                for s in getattr(res, "seasons", [])
            ],
        }


    # ----------------- Review Service Operations ----------------- #
    def register_user(self, username: str, password: str) -> dict:
        req = r_pb2.RegisterUserRequest(username=username, password=password)
        res = self.review_stub.RegisterUser(req, timeout=5.0)
        return {
            "success": res.success,
            "message": res.message,
            "user_id": res.user_id,
            "username": res.username,
        }

    def authenticate_user(self, username: str, password: str) -> dict:
        req = r_pb2.AuthenticateUserRequest(username=username, password=password)
        res = self.review_stub.AuthenticateUser(req, timeout=5.0)
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
        )
        res = self.review_stub.CreateReview(req, timeout=5.0)
        return {
            "review_id": res.review_id,
            "tmdb_id": res.tmdb_id,
            "user_id": res.user_id,
            "rating": round(float(res.rating), 1),
            "comment": res.comment,
            "contains_spoilers": res.contains_spoilers,
            "created_at": res.created_at,
            "media_type": getattr(res, "media_type", "movie") or "movie",
            "season_number": res.season_number if res.season_number > 0 else None,
            "episode_number": res.episode_number if res.episode_number > 0 else None,
            "success": res.success,
            "message": res.message,
        }

    def get_all_reviews(self, limit: int = 50) -> list[dict]:
        req = r_pb2.GetAllReviewsRequest(limit=limit)
        res = self.review_stub.GetAllReviews(req, timeout=5.0)
        return [
            {
                "review_id": r.review_id,
                "tmdb_id": r.tmdb_id,
                "movie_title": r.movie_title,
                "user_id": r.user_id,
                "rating": round(float(r.rating), 1),
                "comment": r.comment,
                "contains_spoilers": r.contains_spoilers,
                "created_at": r.created_at,
                "media_type": getattr(r, "media_type", "movie") or "movie",
                "season_number": r.season_number if getattr(r, "season_number", 0) > 0 else None,
                "episode_number": r.episode_number if getattr(r, "episode_number", 0) > 0 else None,
                "success": True,
                "message": "",
            }
            for r in res.reviews
        ]

    def get_reviews_by_movie(self, tmdb_id: int) -> list[dict]:
        req = r_pb2.MovieReviewsRequest(tmdb_id=tmdb_id)
        res = self.review_stub.GetReviewsByMovie(req, timeout=5.0)
        return [
            {
                "review_id": r.review_id,
                "tmdb_id": r.tmdb_id,
                "movie_title": r.movie_title,
                "user_id": r.user_id,
                "rating": round(float(r.rating), 1),
                "comment": r.comment,
                "contains_spoilers": r.contains_spoilers,
                "created_at": r.created_at,
                "media_type": getattr(r, "media_type", "movie") or "movie",
                "season_number": r.season_number if getattr(r, "season_number", 0) > 0 else None,
                "episode_number": r.episode_number if getattr(r, "episode_number", 0) > 0 else None,
                "success": True,
                "message": "",
            }
            for r in res.reviews
        ]


def get_grpc_manager() -> GatewayGRPCManager:
    return GatewayGRPCManager.get_instance()
