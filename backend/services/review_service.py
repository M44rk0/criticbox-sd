import logging
import os
import sys
from concurrent import futures

import grpc
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from datetime import datetime, timezone

from generated import review_pb2 as r_pb2
from generated import review_pb2_grpc as r_pb2_grpc
from services import storage as database
from services import tmdb as tmdb_service

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [ReviewService] %(message)s")
logger = logging.getLogger("ReviewService")

PORT = int(os.getenv("REVIEW_SERVICE_PORT", "50052"))


class ReviewServiceServicer(r_pb2_grpc.ReviewServiceServicer):
    def __init__(self):
        database.init_db()
        logger.info("Banco de dados inicializado no ReviewService.")

    def CreateReview(self, request, context):

        media_type = getattr(request, "media_type", "movie") or "movie"
        season_num = request.season_number if request.season_number > 0 else None
        episode_num = request.episode_number if request.episode_number > 0 else None

        logger.info(
            "CreateReview -> Usuario: @%s | ID: %d (%s S%sE%s) | Nota: %.1f",
            request.user_id,
            request.tmdb_id,
            media_type,
            season_num,
            episode_num,
            request.rating,
        )
        if not (0.5 <= request.rating <= 5.0):
            return r_pb2.ReviewResponse(
                success=False,
                message="A nota deve estar entre 0.5 e 5.0 estrelas.",
            )
        if not request.user_id.strip():
            return r_pb2.ReviewResponse(
                success=False,
                message="O identificador do usuário não pode estar em branco.",
            )

        details = None
        try:
            details = tmdb_service.get_movie_details(request.tmdb_id, media_type=media_type)
            if details and details.get("release_date"):
                today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                if details["release_date"] > today_str:
                    return r_pb2.ReviewResponse(
                        success=False,
                        message=f"Este título ainda não estreou (data de lançamento: {details['release_date']}). Avaliações só são permitidas após a estreia oficial.",
                    )
        except Exception as e:
            logger.warning("Falha ao verificar estreia do título %d: %s", request.tmdb_id, e)

        movie_title = getattr(request, "movie_title", "") or ""
        if not movie_title:
            try:
                movie_title = tmdb_service.get_movie_title(request.tmdb_id, media_type=media_type)
            except Exception:
                movie_title = ""

        poster_url = getattr(request, "poster_url", "") or ""
        if not poster_url and details:
            poster_url = details.get("poster_url", "") or ""

        username = getattr(request, "username", "") or ""
        res = database.add_review(
            tmdb_id=request.tmdb_id,
            user_id=request.user_id.strip(),
            rating=round(float(request.rating), 1),
            comment=request.comment.strip(),
            contains_spoilers=request.contains_spoilers,
            media_type=media_type,
            season_number=season_num,
            episode_number=episode_num,
            movie_title=movie_title,
            poster_url=poster_url,
            username=username.strip(),
        )
        return r_pb2.ReviewResponse(
            review_id=res["review_id"],
            tmdb_id=res["tmdb_id"],
            user_id=res["user_id"],
            username=res.get("username", "") or username,
            rating=res["rating"],
            comment=res["comment"],
            contains_spoilers=res["contains_spoilers"],
            created_at=res["created_at"],
            success=res["success"],
            message=res["message"],
            media_type=res.get("media_type") or media_type,
            season_number=res.get("season_number", 0),
            episode_number=res.get("episode_number", 0),
            movie_title=res.get("movie_title") or movie_title,
            poster_url=res.get("poster_url") or poster_url,
        )

    def GetMovieStats(self, request, context):
        stats = database.get_movie_stats(request.tmdb_id)
        return r_pb2.MovieStatsResponse(
            tmdb_id=request.tmdb_id,
            average_rating=stats["average_rating"],
            total_count=stats["total_count"],
        )

    def GetBatchMovieStats(self, request, context):
        tmdb_ids = list(request.tmdb_ids)
        stats_map = database.get_batch_movie_stats(tmdb_ids)
        res_map = {}
        for tid, s in stats_map.items():
            res_map[tid] = r_pb2.MovieStatsResponse(
                tmdb_id=tid,
                average_rating=s["average_rating"],
                total_count=s["total_count"],
            )
        return r_pb2.BatchMovieStatsResponse(stats=res_map)

    def GetAllReviews(self, request, context):
        limit = request.limit if request.limit > 0 else 50
        logger.info("GetAllReviews -> Buscando até %d reviews no banco", limit)
        raw_reviews = database.get_all_reviews(limit=limit)
        items = []
        for r in raw_reviews:
            title = r.get("movie_title")
            if not title:
                title = tmdb_service.get_movie_title(r["tmdb_id"], media_type=r.get("media_type") or "movie")
            poster = r.get("poster_url") or ""
            if not poster:
                try:
                    details = tmdb_service.get_movie_details(r["tmdb_id"], media_type=r.get("media_type") or "movie")
                    if details and details.get("poster_url"):
                        poster = details["poster_url"]
                        database.update_review_poster(r["review_id"], poster)
                except Exception:
                    pass
            items.append(
                r_pb2.ReviewItem(
                    review_id=r["review_id"],
                    tmdb_id=r["tmdb_id"],
                    movie_title=title,
                    user_id=r["user_id"],
                    username=r.get("username", "") or r["user_id"],
                    rating=r["rating"],
                    comment=r["comment"],
                    contains_spoilers=r["contains_spoilers"],
                    created_at=r["created_at"],
                    media_type=r.get("media_type") or "movie",
                    season_number=r.get("season_number", 0),
                    episode_number=r.get("episode_number", 0),
                    poster_url=poster,
                )
            )
        return r_pb2.GetAllReviewsResponse(reviews=items, total_count=len(items))

    def GetReviewsByMovie(self, request, context):
        logger.info("GetReviewsByMovie -> Buscando reviews para o filme tmdb_id=%d", request.tmdb_id)
        raw_reviews = database.get_reviews_by_movie(request.tmdb_id)
        movie_title = ""
        for r in raw_reviews:
            if r.get("movie_title"):
                movie_title = r["movie_title"]
                break
        if not movie_title:
            media_type = getattr(request, "media_type", "movie") or "movie"
            movie_title = tmdb_service.get_movie_title(request.tmdb_id, media_type=media_type)

        items = []
        for r in raw_reviews:
            poster = r.get("poster_url") or ""
            if not poster:
                try:
                    details = tmdb_service.get_movie_details(r["tmdb_id"], media_type=r.get("media_type") or "movie")
                    if details and details.get("poster_url"):
                        poster = details["poster_url"]
                        database.update_review_poster(r["review_id"], poster)
                except Exception:
                    pass
            items.append(
                r_pb2.ReviewItem(
                    review_id=r["review_id"],
                    tmdb_id=r["tmdb_id"],
                    movie_title=r.get("movie_title") or movie_title,
                    user_id=r["user_id"],
                    username=r.get("username", "") or r["user_id"],
                    rating=r["rating"],
                    comment=r["comment"],
                    contains_spoilers=r["contains_spoilers"],
                    created_at=r["created_at"],
                    media_type=r.get("media_type") or "movie",
                    season_number=r.get("season_number", 0),
                    episode_number=r.get("episode_number", 0),
                    poster_url=poster,
                )
            )
        return r_pb2.GetAllReviewsResponse(reviews=items, total_count=len(items))

    def GetReviewsByUser(self, request, context):
        req_username = getattr(request, "username", "") or ""
        logger.info(
            "GetReviewsByUser -> Buscando reviews para o usuário @%s (id=%s)",
            req_username or request.user_id,
            request.user_id,
        )
        raw_reviews = database.get_reviews_by_user(user_id=request.user_id, username=req_username)
        items = []
        for r in raw_reviews:
            title = r.get("movie_title")
            if not title:
                title = tmdb_service.get_movie_title(r["tmdb_id"], media_type=r.get("media_type") or "movie")
            poster = r.get("poster_url") or ""
            if not poster:
                try:
                    details = tmdb_service.get_movie_details(r["tmdb_id"], media_type=r.get("media_type") or "movie")
                    if details and details.get("poster_url"):
                        poster = details["poster_url"]
                        database.update_review_poster(r["review_id"], poster)
                except Exception:
                    pass
            items.append(
                r_pb2.ReviewItem(
                    review_id=r["review_id"],
                    tmdb_id=r["tmdb_id"],
                    movie_title=title,
                    user_id=r["user_id"],
                    username=r.get("username", "") or r["user_id"],
                    rating=r["rating"],
                    comment=r["comment"],
                    contains_spoilers=r["contains_spoilers"],
                    created_at=r["created_at"],
                    media_type=r.get("media_type") or "movie",
                    season_number=r.get("season_number", 0),
                    episode_number=r.get("episode_number", 0),
                    poster_url=poster,
                )
            )
        return r_pb2.GetAllReviewsResponse(reviews=items, total_count=len(items))


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    r_pb2_grpc.add_ReviewServiceServicer_to_server(ReviewServiceServicer(), server)
    server_address = f"0.0.0.0:{PORT}"
    server.add_insecure_port(server_address)
    logger.info("Servidor gRPC ReviewService escutando em %s", server_address)
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
