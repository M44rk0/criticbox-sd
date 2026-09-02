import os
import sys
from concurrent import futures

import grpc
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.extend([os.path.join(BASE_DIR, "generated"), os.path.join(BASE_DIR, "server")])

import criticbox_pb2 as pb2
import criticbox_pb2_grpc as pb2_grpc
import database
import tmdb_service

load_dotenv()
PORT = os.getenv("GRPC_SERVER_PORT", "50051")


def _to_review_pb(r: dict) -> pb2.ReviewResponse:
    return pb2.ReviewResponse(
        review_id=r.get("review_id", ""),
        tmdb_id=r["tmdb_id"],
        user_id=r["user_id"],
        rating=r["rating"],
        comment=r.get("comment", ""),
        contains_spoilers=r.get("contains_spoilers", False),
        created_at=r.get("created_at", ""),
        success=r.get("success", True),
        message=r.get("message", ""),
    )


def _to_summary_pb(item: dict) -> pb2.MovieSummary:
    stats = database.get_movie_stats(item["id"])
    return pb2.MovieSummary(
        tmdb_id=item["id"],
        title=item["title"],
        release_date=item["release_date"],
        poster_url=item["poster_url"],
        overview=item["overview"],
        tmdb_vote_average=round(float(item["tmdb_vote_average"]), 1),
        criticbox_rating=stats["average_rating"],
        criticbox_review_count=stats["total_count"],
    )


class CriticboxServicer(pb2_grpc.CriticboxServiceServicer):
    def __init__(self):
        database.init_db()

    def SearchMovies(self, request, context):
        page = max(request.page, 1)
        print(f"[RPC LOG] SearchMovies -> Buscando: '{request.query}' (Pagina {page})")
        data = tmdb_service.search_movies(request.query, page)
        summaries = [_to_summary_pb(m) for m in data["results"]]
        print(f"[RPC LOG] SearchMovies -> Encontrados {data['total_results']} resultados.")
        return pb2.SearchMoviesResponse(movies=summaries, page=data["page"], total_results=data["total_results"])

    def CreateReview(self, request, context):
        print(
            f"[RPC LOG] CreateReview -> Usuario: @{request.user_id} | Filme ID: {request.tmdb_id} | Nota: {request.rating}"
        )
        if not (0.5 <= request.rating <= 5.0):
            print("  [-] Validacao falhou: Nota fora do limite (0.5 a 5.0)")
            return pb2.ReviewResponse(success=False, message="A nota deve estar entre 0.5 e 5.0 estrelas.")
        if not request.user_id.strip():
            print("  [-] Validacao falhou: user_id vazio")
            return pb2.ReviewResponse(success=False, message="O campo user_id nao pode estar vazio.")

        res = database.add_review(
            tmdb_id=request.tmdb_id,
            user_id=request.user_id.strip(),
            rating=request.rating,
            comment=request.comment.strip(),
            contains_spoilers=request.contains_spoilers,
        )
        print(f"[RPC LOG] CreateReview -> Review gravada com sucesso no SQLite (ID: {res['review_id']})")
        return _to_review_pb(res)

    def GetAllReviews(self, request, context):
        print("[RPC LOG] GetAllReviews -> Listando reviews de todos os usuarios.")
        raw_reviews = database.get_all_reviews()
        reviews = []
        for r in raw_reviews:
            movie_title = tmdb_service.get_movie_title(r["tmdb_id"])
            reviews.append(
                pb2.UserReviewItem(
                    review_id=r["review_id"],
                    tmdb_id=r["tmdb_id"],
                    movie_title=movie_title,
                    user_id=r["user_id"],
                    rating=r["rating"],
                    comment=r["comment"],
                    contains_spoilers=r["contains_spoilers"],
                    created_at=r["created_at"],
                )
            )
        print(f"[RPC LOG] GetAllReviews -> Retornando {len(reviews)} reviews de todos os usuarios.")
        return pb2.GetAllReviewsResponse(
            reviews=reviews,
            total_count=len(reviews),
        )


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    pb2_grpc.add_CriticboxServiceServicer_to_server(CriticboxServicer(), server)
    server_address = f"0.0.0.0:{PORT}"
    server.add_insecure_port(server_address)
    print(f"[*] Servidor gRPC Criticbox escutando em {server_address}")
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
