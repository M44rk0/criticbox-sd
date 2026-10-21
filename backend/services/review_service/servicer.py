import os
import sys
from concurrent import futures
from datetime import datetime, timezone

import grpc
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from common.telemetry import configure_service_logger, traced_rpc
from generated import review_pb2 as r_pb2
from generated import review_pb2_grpc as r_pb2_grpc
from services import tmdb as tmdb_service
from services.review_service import storage as database

load_dotenv()

logger = configure_service_logger("ReviewService")

PORT = int(os.getenv("REVIEW_SERVICE_PORT", "50052"))


def _build_review_item_pb(r: dict, default_title: str = "") -> r_pb2.ReviewItem:
    media_type = r.get("media_type") or "movie"
    title = r.get("movie_title") or default_title
    if not title:
        try:
            title = tmdb_service.get_movie_title(r["tmdb_id"], media_type=media_type)
        except Exception:
            title = f"Título #{r['tmdb_id']}"

    poster = r.get("poster_url") or ""
    if not poster:
        try:
            details = tmdb_service.get_movie_details(r["tmdb_id"], media_type=media_type)
            if details and details.get("poster_url"):
                poster = details["poster_url"]
                database.update_review_poster(r["review_id"], poster)
        except Exception:
            pass

    return r_pb2.ReviewItem(
        review_id=r["review_id"],
        tmdb_id=r["tmdb_id"],
        movie_title=title,
        user_id=r["user_id"],
        username=r.get("username", "") or r["user_id"],
        rating=r["rating"],
        comment=r.get("comment", "") or "",
        contains_spoilers=bool(r.get("contains_spoilers")),
        created_at=r.get("created_at", "") or "",
        media_type=media_type,
        season_number=r.get("season_number", 0),
        episode_number=r.get("episode_number", 0),
        poster_url=poster,
    )


class ReviewServiceServicer(r_pb2_grpc.ReviewServiceServicer):
    def __init__(self):
        database.init_db()
        logger.info("Banco de dados isolado inicializado no ReviewService.")

    @traced_rpc()
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
        rounded_rating = round(float(request.rating), 1)
        valid_ratings = {0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0}
        if rounded_rating not in valid_ratings or abs(float(request.rating) - rounded_rating) > 1e-4:
            return r_pb2.ReviewResponse(
                success=False,
                message="A nota deve estar entre 0.5 e 5.0",
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

        if details:
            movie_title = details.get("title") or tmdb_service.get_movie_title(request.tmdb_id, media_type=media_type) or ""
            poster_url = details.get("poster_url") or ""
            media_type = details.get("media_type") or media_type
        else:
            try:
                movie_title = tmdb_service.get_movie_title(request.tmdb_id, media_type=media_type)
            except Exception:
                movie_title = getattr(request, "movie_title", "") or ""
            poster_url = getattr(request, "poster_url", "") or ""

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

    @traced_rpc()
    def GetMovieStats(self, request, context):
        stats = database.get_movie_stats(request.tmdb_id)
        logger.info(
            "GetMovieStats -> tmdb_id=%d -> %.1f (%d avaliações)",
            request.tmdb_id,
            stats["average_rating"],
            stats["total_count"],
        )
        return r_pb2.MovieStatsResponse(
            tmdb_id=request.tmdb_id,
            average_rating=stats["average_rating"],
            total_count=stats["total_count"],
        )

    @traced_rpc()
    def GetBatchMovieStats(self, request, context):
        tmdb_ids = list(request.tmdb_ids)
        stats_map = database.get_batch_movie_stats(tmdb_ids)
        logger.info("GetBatchMovieStats -> %d títulos consultados em lote", len(tmdb_ids))
        res_map = {}
        for tid, s in stats_map.items():
            res_map[tid] = r_pb2.MovieStatsResponse(
                tmdb_id=tid,
                average_rating=s["average_rating"],
                total_count=s["total_count"],
            )
        return r_pb2.BatchMovieStatsResponse(stats=res_map)

    @traced_rpc()
    def GetAllReviews(self, request, context):
        limit = request.limit if request.limit > 0 else 50
        logger.info("GetAllReviews -> Buscando até %d reviews no banco", limit)
        raw_reviews = database.get_all_reviews(limit=limit)
        items = [_build_review_item_pb(r) for r in raw_reviews]
        return r_pb2.GetAllReviewsResponse(reviews=items, total_count=len(items))

    @traced_rpc()
    def GetReviewsByMovie(self, request, context):
        logger.info("GetReviewsByMovie -> Buscando reviews para o filme tmdb_id=%d", request.tmdb_id)
        raw_reviews = database.get_reviews_by_movie(request.tmdb_id)
        movie_title = next((r["movie_title"] for r in raw_reviews if r.get("movie_title")), "")
        if not movie_title:
            media_type = getattr(request, "media_type", "movie") or "movie"
            movie_title = tmdb_service.get_movie_title(request.tmdb_id, media_type=media_type)

        items = [_build_review_item_pb(r, default_title=movie_title) for r in raw_reviews]
        return r_pb2.GetAllReviewsResponse(reviews=items, total_count=len(items))

    @traced_rpc()
    def GetReviewsByUser(self, request, context):
        req_username = getattr(request, "username", "") or ""
        logger.info(
            "GetReviewsByUser -> Buscando reviews para o usuário @%s (id=%s)",
            req_username or request.user_id,
            request.user_id,
        )
        raw_reviews = database.get_reviews_by_user(user_id=request.user_id, username=req_username)
        items = [_build_review_item_pb(r) for r in raw_reviews]
        return r_pb2.GetAllReviewsResponse(reviews=items, total_count=len(items))

    @traced_rpc()
    def DeleteReview(self, request, context):
        req_username = getattr(request, "username", "") or ""
        logger.info(
            "DeleteReview -> review_id=%s | user_id=%s | username=@%s",
            request.review_id,
            request.user_id,
            req_username,
        )
        res = database.delete_review(
            review_id=request.review_id,
            user_id=request.user_id,
            username=req_username,
        )
        return r_pb2.DeleteReviewResponse(
            success=res["success"],
            message=res["message"],
        )


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
