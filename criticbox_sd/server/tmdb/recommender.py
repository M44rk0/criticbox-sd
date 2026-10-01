import logging
from concurrent.futures import ThreadPoolExecutor

import tmdbsimple as tmdb

from criticbox_sd.server.tmdb.cache import _get_from_cache, _set_cache
from criticbox_sd.server.tmdb.client import API_KEY
from criticbox_sd.server.tmdb.extractors import _fmt

logger = logging.getLogger("criticbox-tmdb-recommender")


def _fetch_seed_recommendations(seed_id: int, media_type: str, page: int = 1) -> list[dict]:
    """Busca recomendações de uma seed individual com cache próprio."""
    cache_key = f"seed_recs:{media_type}:{seed_id}:{page}"
    cached = _get_from_cache(cache_key)
    if cached is not None:
        return cached

    try:
        if media_type == "tv":
            rec_data = tmdb.TV(seed_id).recommendations(page=page, language="pt-BR")
        else:
            rec_data = tmdb.Movies(seed_id).recommendations(page=page, language="pt-BR")

        items = [
            _fmt(item, default_media_type=media_type) for item in rec_data.get("results", []) if item.get("poster_path")
        ]
        _set_cache(cache_key, items)
        return items
    except Exception:
        _set_cache(cache_key, [])
        return []


def get_recommendations_for_user(user_id: str | None = None, page: int = 1) -> dict:
    """Retorna títulos recomendados com base nas reviews positivas do usuário.
    Usa paralelismo para buscar recomendações de múltiplas seeds ao mesmo tempo.
    Ranqueia por afinidade de gênero para dar preferência ao gosto real do usuário.
    Se não houver reviews ou for anônimo, retorna os títulos mais aclamados (top-rated)."""
    if not API_KEY:
        return {"page": 1, "total_pages": 1, "total_results": 0, "results": []}

    cache_key = f"user_recs:{user_id or 'anon'}:{page}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    seed_recs_lists = []
    reviewed_ids = set()
    genre_scores: dict[int, float] = {}

    if user_id and str(user_id).strip():
        try:
            from criticbox_sd.server import storage as database

            user_reviews = database.get_reviews_by_user(str(user_id).strip())
            reviewed_ids = {r["tmdb_id"] for r in user_reviews}

            positive_reviews = [r for r in user_reviews if r.get("rating", 0) >= 3.0]
            positive_reviews.sort(key=lambda x: (x.get("rating", 0), x.get("created_at", "")), reverse=True)

            seen_seed_ids = set()
            unique_seeds = []
            for r in positive_reviews:
                tid = r["tmdb_id"]
                if tid not in seen_seed_ids:
                    seen_seed_ids.add(tid)
                    unique_seeds.append(r)

            top_seeds = unique_seeds[:8]

            if top_seeds:

                def _fetch_for_seed(seed):
                    tid = seed["tmdb_id"]
                    m_type = seed.get("media_type") or "movie"
                    recs = _fetch_seed_recommendations(tid, m_type, page=page)
                    seed_genre_ids = []
                    detail_cache_key = f"details:{m_type}:{tid}"
                    cached_detail = _get_from_cache(detail_cache_key)
                    if cached_detail:
                        seed_genre_ids = cached_detail.get("genre_ids", [])
                    return seed, recs, seed_genre_ids

                with ThreadPoolExecutor(max_workers=min(len(top_seeds), 8)) as executor:
                    futures = [executor.submit(_fetch_for_seed, s) for s in top_seeds]
                    for fut in futures:
                        try:
                            seed, items, seed_gids = fut.result(timeout=4.0)
                            if items:
                                seed_recs_lists.append(items)
                            rating = seed.get("rating", 3.0)
                            for gid in seed_gids:
                                genre_scores[gid] = genre_scores.get(gid, 0) + rating
                            if not seed_gids and items:
                                for item in items[:3]:
                                    for gid in item.get("genre_ids", []):
                                        genre_scores[gid] = genre_scores.get(gid, 0) + (rating * 0.3)
                        except Exception:
                            pass

        except Exception as e:
            logger.warning("Falha ao calcular recomendações para user %s: %s", user_id, e)

    seen_ids = set()
    interleaved_recs = []
    if seed_recs_lists:
        max_depth = max(len(lst) for lst in seed_recs_lists)
        for depth in range(max_depth):
            for lst in seed_recs_lists:
                if depth < len(lst):
                    item = lst[depth]
                    mid = item.get("id")
                    if mid and mid not in seen_ids and mid not in reviewed_ids:
                        seen_ids.add(mid)
                        interleaved_recs.append(item)

    if genre_scores and interleaved_recs:

        def _genre_affinity(item):
            gids = item.get("genre_ids", [])
            return sum(genre_scores.get(gid, 0) for gid in gids)

        interleaved_recs.sort(key=_genre_affinity, reverse=True)

    if len(interleaved_recs) < 5:
        try:
            top_rated = tmdb.Movies().top_rated(page=page, language="pt-BR")
            for item in top_rated.get("results", []):
                mid = item.get("id")
                if item.get("poster_path") and mid not in seen_ids and mid not in reviewed_ids:
                    seen_ids.add(mid)
                    interleaved_recs.append(_fmt(item, default_media_type="movie"))
        except Exception:
            pass

    payload = {
        "page": page,
        "total_pages": 10 if len(interleaved_recs) >= 10 else 1,
        "total_results": len(interleaved_recs),
        "results": interleaved_recs[:20],
    }
    _set_cache(cache_key, payload)
    return payload
