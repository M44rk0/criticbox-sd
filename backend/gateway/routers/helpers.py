import logging

logger = logging.getLogger("criticbox-gateway-helpers")


def resolve_canonical_media_metadata(
    tmdb_id: int,
    media_type: str,
    grpc_manager,
    fallback_title: str = "",
    fallback_poster: str = "",
) -> tuple[str, str, str]:
    """Obtém metadados oficiais e autoritativos do MovieService via gRPC.

    Sobrescreve dados de cliente com os dados canônicos do catálogo TMDb,
    mantendo fallback gracioso caso o serviço esteja indisponível.
    """
    official_title = (fallback_title or "").strip()
    official_poster = (fallback_poster or "").strip()
    official_media_type = media_type or "movie"

    try:
        details = grpc_manager.get_movie_details(tmdb_id, media_type=official_media_type)
        if details:
            official_title = details.get("title") or official_title
            official_poster = details.get("poster_url") or official_poster
            official_media_type = details.get("media_type") or official_media_type
    except Exception as e:
        logger.warning("Falha ao consultar MovieService para tmdb_id=%d: %s", tmdb_id, e)

    return official_title, official_poster, official_media_type

