import os
import sys
from concurrent import futures

import grpc
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from common.telemetry import TraceClientInterceptor, configure_service_logger, traced_rpc
from generated import movie_pb2 as m_pb2
from generated import movie_pb2_grpc as m_pb2_grpc
from generated import review_pb2 as r_pb2
from generated import review_pb2_grpc as r_pb2_grpc
from services import tmdb as tmdb_service

load_dotenv()

logger = configure_service_logger("MovieService")

PORT = int(os.getenv("MOVIE_SERVICE_PORT", "50051"))
REVIEW_HOST = os.getenv("REVIEW_SERVICE_HOST", "localhost")
REVIEW_PORT = os.getenv("REVIEW_SERVICE_PORT", "50052")

_review_channel = None
_review_stub = None


def _get_review_stub() -> r_pb2_grpc.ReviewServiceStub:
    global _review_channel, _review_stub
    if _review_channel is None or _review_stub is None:
        target = f"{REVIEW_HOST}:{REVIEW_PORT}"
        logger.info("Criando canal persistente com ReviewService em %s (com rastreabilidade)", target)
        _review_channel = grpc.intercept_channel(grpc.insecure_channel(target), TraceClientInterceptor())
        _review_stub = r_pb2_grpc.ReviewServiceStub(_review_channel)
    return _review_stub


def _fetch_movie_stats_via_grpc(tmdb_id: int) -> tuple[float, int]:
    try:
        stub = _get_review_stub()
        response = stub.GetMovieStats(r_pb2.MovieStatsRequest(tmdb_id=tmdb_id), timeout=2.0)
        return response.average_rating, response.total_count
    except grpc.RpcError as e:
        logger.warning("Falha na chamada gRPC inter-serviço (ReviewService): %s", e)
        return 0.0, 0


def _fetch_batch_movie_stats_via_grpc(tmdb_ids: list[int]) -> dict[int, tuple[float, int]]:
    if not tmdb_ids:
        return {}
    try:
        stub = _get_review_stub()
        response = stub.GetBatchMovieStats(r_pb2.BatchMovieStatsRequest(tmdb_ids=tmdb_ids), timeout=3.0)
        result = {}
        for tid, stat in response.stats.items():
            result[tid] = (stat.average_rating, stat.total_count)
        return result
    except grpc.RpcError as e:
        logger.warning("Falha na chamada gRPC batch inter-serviço (ReviewService): %s", e)
        return {}


def _to_movie_summary_pb(item: dict, stats_map: dict[int, tuple[float, int]] | None = None) -> m_pb2.MovieSummary:
    tmdb_id = item.get("id", 0)
    if stats_map is not None and tmdb_id in stats_map:
        avg_rating, total_count = stats_map[tmdb_id]
    else:
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
    def _build_catalog_response(self, data: dict) -> m_pb2.SearchMoviesResponse:
        results = data.get("results", [])
        tmdb_ids = [m.get("id", 0) for m in results if m.get("id")]
        stats_map = _fetch_batch_movie_stats_via_grpc(tmdb_ids)
        summaries = [_to_movie_summary_pb(m, stats_map=stats_map) for m in results]
        return m_pb2.SearchMoviesResponse(
            movies=summaries,
            page=data.get("page", 1),
            total_results=data.get("total_results", len(summaries)),
            total_pages=data.get("total_pages", 1),
        )

    @traced_rpc()
    def SearchMovies(self, request, context):
        page = max(request.page, 1)
        query = request.query.strip()
        logger.info("SearchMovies -> Buscando: '%s' (Página %d)", query, page)
        data = tmdb_service.search_movies(query, page)
        logger.info("SearchMovies -> Encontrados %d títulos.", len(data.get("results", [])))
        return self._build_catalog_response(data)

    @traced_rpc()
    def GetTrendingMovies(self, request, context):
        time_window = request.time_window or "week"
        page = max(request.page, 1)
        logger.info("GetTrendingMovies -> Buscando destaques (%s, Página %d)", time_window, page)
        data = tmdb_service.get_trending_movies(time_window=time_window, page=page)
        return self._build_catalog_response(data)

    @traced_rpc()
    def GetNowPlayingMovies(self, request, context):
        page = max(request.page, 1)
        logger.info("GetNowPlayingMovies -> Buscando filmes em cartaz (Página %d)", page)
        data = tmdb_service.get_now_playing_movies(page=page)
        return self._build_catalog_response(data)

    @traced_rpc()
    def GetMovieDetails(self, request, context):
        media_type = getattr(request, "media_type", "") or ""
        logger.info("GetMovieDetails -> ID: %d (media_type: %s)", request.tmdb_id, media_type)
        with futures.ThreadPoolExecutor(max_workers=2) as executor:
            fut_details = executor.submit(tmdb_service.get_movie_details, request.tmdb_id, media_type=media_type)
            fut_stats = executor.submit(_fetch_movie_stats_via_grpc, request.tmdb_id)
            details = fut_details.result()
            avg_rating, total_count = fut_stats.result()

        if not details:
            return m_pb2.MovieDetailsResponse(tmdb_id=request.tmdb_id, found=False)

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

        networks_pbs = [
            m_pb2.NetworkInfo(
                name=n.get("name", ""),
                logo_url=n.get("logo_url", ""),
            )
            for n in details.get("networks", [])
        ]

        wp_data = details.get("watch_providers", {})

        def _to_provider_item(p):
            return m_pb2.ProviderItem(
                provider_name=p.get("provider_name", ""),
                logo_url=p.get("logo_url", ""),
            )

        wp_pb = m_pb2.WatchProviders(
            flatrate=[_to_provider_item(p) for p in wp_data.get("flatrate", [])],
            rent=[_to_provider_item(p) for p in wp_data.get("rent", [])],
            buy=[_to_provider_item(p) for p in wp_data.get("buy", [])],
        )

        recs_pbs = [
            m_pb2.MovieSummary(
                tmdb_id=m.get("id", 0),
                title=m.get("title", ""),
                release_date=m.get("release_date") or "",
                poster_url=m.get("poster_url") or "",
                backdrop_url=m.get("backdrop_url") or "",
                overview=m.get("overview") or "",
                tmdb_vote_average=round(float(m.get("tmdb_vote_average", 0.0)), 1),
                criticbox_rating=0.0,
                criticbox_review_count=0,
                media_type=m.get("media_type") or "movie",
            )
            for m in details.get("recommendations", [])
        ]

        lep_data = details.get("last_episode_to_air")
        last_ep_pb = None
        if lep_data:
            last_ep_pb = m_pb2.EpisodeSummary(
                episode_number=lep_data.get("episode_number", 0),
                season_number=lep_data.get("season_number", 0),
                name=lep_data.get("name", ""),
                air_date=lep_data.get("air_date", ""),
                overview=lep_data.get("overview", ""),
                still_url=lep_data.get("still_url", ""),
                vote_average=float(lep_data.get("vote_average", 0.0)),
            )

        nep_data = details.get("next_episode_to_air")
        next_ep_pb = None
        if nep_data:
            next_ep_pb = m_pb2.EpisodeSummary(
                episode_number=nep_data.get("episode_number", 0),
                season_number=nep_data.get("season_number", 0),
                name=nep_data.get("name", ""),
                air_date=nep_data.get("air_date", ""),
                overview=nep_data.get("overview", ""),
                still_url=nep_data.get("still_url", ""),
                vote_average=float(nep_data.get("vote_average", 0.0)),
            )

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
            original_title=details.get("original_title") or "",
            original_language=details.get("original_language") or "",
            spoken_languages=details.get("spoken_languages", []),
            certification=details.get("certification") or "",
            vote_count=int(details.get("vote_count", 0)),
            popularity=float(details.get("popularity", 0.0)),
            budget=int(details.get("budget", 0)),
            revenue=int(details.get("revenue", 0)),
            status=details.get("status") or "",
            imdb_id=details.get("imdb_id") or "",
            homepage=details.get("homepage") or "",
            logo_url=details.get("logo_url") or "",
            photos=details.get("photos", []),
            writers=details.get("writers", []),
            music_composers=details.get("music_composers", []),
            cinematographers=details.get("cinematographers", []),
            producers=details.get("producers", []),
            networks=networks_pbs,
            watch_providers=wp_pb,
            recommendations=recs_pbs,
            last_episode_to_air=last_ep_pb,
            next_episode_to_air=next_ep_pb,
            first_air_date=details.get("first_air_date") or "",
            last_air_date=details.get("last_air_date") or "",
        )

    @traced_rpc()
    def GetTrendingTV(self, request, context):
        time_window = request.time_window or "week"
        page = max(request.page, 1)
        logger.info("GetTrendingTV -> Buscando séries em alta (%s, Página %d)", time_window, page)
        data = tmdb_service.get_trending_tv(time_window=time_window, page=page)
        return self._build_catalog_response(data)

    @traced_rpc()
    def GetRecommendations(self, request, context):
        user_id = request.user_id or ""
        page = max(request.page, 1)
        logger.info("GetRecommendations -> Buscando recomendações para @%s (Página %d)", user_id, page)
        data = tmdb_service.get_recommendations_for_user(user_id=user_id, page=page)
        return self._build_catalog_response(data)

    @traced_rpc()
    def GetSeasonEpisodes(self, request, context):
        logger.info("GetSeasonEpisodes -> tmdb_id=%d, season=%d", request.tmdb_id, request.season_number)
        data = tmdb_service.get_season_episodes(request.tmdb_id, request.season_number)
        eps = [
            m_pb2.EpisodeSummary(
                episode_number=e.get("episode_number", 0),
                season_number=e.get("season_number", request.season_number),
                name=e.get("name", ""),
                air_date=e.get("air_date") or "",
                overview=e.get("overview") or "",
                still_url=e.get("still_url") or "",
                vote_average=round(float(e.get("vote_average", 0.0)), 1),
            )
            for e in data.get("episodes", [])
        ]
        return m_pb2.SeasonEpisodesResponse(episodes=eps)

    @traced_rpc()
    def GetAllEpisodes(self, request, context):
        logger.info("GetAllEpisodes -> tmdb_id=%d", request.tmdb_id)
        all_data = tmdb_service.get_all_series_episodes(request.tmdb_id)
        seasons_map = {}
        for s_num_str, eps_list in all_data.items():
            eps = [
                m_pb2.EpisodeSummary(
                    episode_number=e.get("episode_number", 0),
                    season_number=e.get("season_number", int(s_num_str) if s_num_str.isdigit() else 1),
                    name=e.get("name", ""),
                    air_date=e.get("air_date") or "",
                    overview=e.get("overview") or "",
                    still_url=e.get("still_url") or "",
                    vote_average=round(float(e.get("vote_average", 0.0)), 1),
                )
                for e in eps_list
            ]
            seasons_map[s_num_str] = m_pb2.SeasonEpisodesList(episodes=eps)
        return m_pb2.AllEpisodesResponse(seasons=seasons_map)


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
