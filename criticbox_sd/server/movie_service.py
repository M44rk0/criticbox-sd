import logging
import os
import sys
from concurrent import futures

import grpc
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from criticbox_sd.generated import movie_pb2 as m_pb2
from criticbox_sd.generated import movie_pb2_grpc as m_pb2_grpc
from criticbox_sd.generated import review_pb2 as r_pb2
from criticbox_sd.generated import review_pb2_grpc as r_pb2_grpc
from criticbox_sd.server import tmdb_service

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [MovieService] %(message)s")
logger = logging.getLogger("MovieService")

PORT = int(os.getenv("MOVIE_SERVICE_PORT", "50051"))
REVIEW_HOST = os.getenv("REVIEW_SERVICE_HOST", "localhost")
REVIEW_PORT = os.getenv("REVIEW_SERVICE_PORT", "50052")


def _get_review_stub():
    channel = grpc.insecure_channel(f"{REVIEW_HOST}:{REVIEW_PORT}")
    return r_pb2_grpc.ReviewServiceStub(channel)


def _fetch_movie_stats_via_grpc(tmdb_id: int) -> tuple[float, int]:
    try:
        stub = _get_review_stub()
        response = stub.GetMovieStats(r_pb2.MovieStatsRequest(tmdb_id=tmdb_id), timeout=2.0)
        return response.average_rating, response.total_count
    except grpc.RpcError as e:
        logger.warning("Falha na chamada gRPC inter-serviço (ReviewService): %s", e)
        return 0.0, 0


def _to_movie_summary_pb(item: dict) -> m_pb2.MovieSummary:
    tmdb_id = item.get("id", 0)
    avg_rating, total_count = _fetch_movie_stats_via_grpc(tmdb_id)

    return m_pb2.MovieSummary(
        tmdb_id=tmdb_id,
        title=item.get("title", ""),
        release_date=item.get("release_date") or "",
        poster_url=item.get("poster_url") or "",
        backdrop_url=item.get("backdrop_url") or "",
        overview=item.get("overview") or "",
        tmdb_vote_average=round(float(item.get("tmdb_vote_average", 0.0)), 1),
        criticbox_rating=round(float(avg_rating), 1),
        criticbox_review_count=int(total_count),
        media_type=item.get("media_type") or "movie",
    )


class MovieServiceServicer(m_pb2_grpc.MovieServiceServicer):
    def SearchMovies(self, request, context):
        page = max(request.page, 1)
        query = request.query.strip()
        logger.info("SearchMovies -> Buscando: '%s' (Página %d)", query, page)
        data = tmdb_service.search_movies(query, page)
        summaries = [_to_movie_summary_pb(m) for m in data.get("results", [])]
        logger.info("SearchMovies -> Encontrados %d títulos.", len(summaries))
        return m_pb2.SearchMoviesResponse(
            movies=summaries,
            page=data.get("page", 1),
            total_results=data.get("total_results", len(summaries)),
            total_pages=data.get("total_pages", 1),
        )

    def GetTrendingMovies(self, request, context):
        time_window = request.time_window or "week"
        page = max(request.page, 1)
        logger.info("GetTrendingMovies -> Buscando destaques (%s, Página %d)", time_window, page)
        data = tmdb_service.get_trending_movies(time_window=time_window, page=page)
        summaries = [_to_movie_summary_pb(m) for m in data.get("results", [])]
        return m_pb2.SearchMoviesResponse(
            movies=summaries,
            page=data.get("page", 1),
            total_results=data.get("total_results", len(summaries)),
            total_pages=data.get("total_pages", 1),
        )

    def DiscoverMovies(self, request, context):
        page = max(request.page, 1)
        genre_id = request.genre_id
        logger.info("DiscoverMovies -> Buscando gênero ID: %d (Página %d)", genre_id, page)
        data = tmdb_service.discover_by_genre(genre_id, page)
        summaries = [_to_movie_summary_pb(m) for m in data.get("results", [])]
        return m_pb2.SearchMoviesResponse(
            movies=summaries,
            page=data.get("page", 1),
            total_results=data.get("total_results", len(summaries)),
            total_pages=data.get("total_pages", 1),
        )

    def GetNowPlayingMovies(self, request, context):
        page = max(request.page, 1)
        logger.info("GetNowPlayingMovies -> Buscando filmes em cartaz (Página %d)", page)
        data = tmdb_service.get_now_playing_movies(page=page)
        summaries = [_to_movie_summary_pb(m) for m in data.get("results", [])]
        return m_pb2.SearchMoviesResponse(
            movies=summaries,
            page=data.get("page", 1),
            total_results=data.get("total_results", len(summaries)),
            total_pages=data.get("total_pages", 1),
        )

    def GetMovieDetails(self, request, context):
        media_type = getattr(request, "media_type", "") or ""
        logger.info("GetMovieDetails -> ID: %d (media_type: %s)", request.tmdb_id, media_type)
        details = tmdb_service.get_movie_details(request.tmdb_id, media_type=media_type)
        if not details:
            return m_pb2.MovieDetailsResponse(tmdb_id=request.tmdb_id, found=False)

        avg_rating, total_count = _fetch_movie_stats_via_grpc(request.tmdb_id)

        cast_pbs = [
            m_pb2.CastMember(
                name=c.get("name", ""),
                character=c.get("character", ""),
                profile_url=c.get("profile_url", ""),
            )
            for c in details.get("cast", [])
        ]

        seasons_pbs = [
            m_pb2.SeasonInfo(
                season_number=s.get("season_number", 1),
                name=s.get("name", ""),
                episode_count=s.get("episode_count", 0),
                poster_url=s.get("poster_url", "") or "",
            )
            for s in details.get("seasons", [])
        ]

        return m_pb2.MovieDetailsResponse(
            tmdb_id=details.get("id", request.tmdb_id),
            title=details.get("title", ""),
            release_date=details.get("release_date") or "",
            poster_url=details.get("poster_url") or "",
            backdrop_url=details.get("backdrop_url") or "",
            overview=details.get("overview") or "",
            tmdb_vote_average=round(float(details.get("tmdb_vote_average", 0.0)), 1),
            criticbox_rating=round(float(avg_rating), 1),
            criticbox_review_count=int(total_count),
            genres=details.get("genres", []),
            runtime=details.get("runtime", 0),
            found=True,
            directors=details.get("directors", []),
            cast=cast_pbs,
            trailer_url=details.get("trailer_url", ""),
            tagline=details.get("tagline", ""),
            media_type=details.get("media_type") or "movie",
            number_of_seasons=details.get("number_of_seasons", 0),
            number_of_episodes=details.get("number_of_episodes", 0),
            seasons=seasons_pbs,
        )




def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    m_pb2_grpc.add_MovieServiceServicer_to_server(MovieServiceServicer(), server)
    server_address = f"0.0.0.0:{PORT}"
    server.add_insecure_port(server_address)
    logger.info("Servidor gRPC MovieService escutando em %s", server_address)
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
