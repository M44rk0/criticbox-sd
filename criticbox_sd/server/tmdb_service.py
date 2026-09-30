import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import requests
import tmdbsimple as tmdb
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("criticbox-tmdb")

API_KEY = os.getenv("TMDB_API_KEY", "").strip()
if API_KEY.startswith("eyJ"):
    tmdb.REQUESTS_SESSION = requests.Session()
    tmdb.REQUESTS_SESSION.headers.update({"Authorization": f"Bearer {API_KEY}"})
tmdb.API_KEY = API_KEY


TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

# In-memory Thread-safe Bounded TTL Cache (TTL = 10 minutes, Max = 1000 items)
_CACHE_LOCK = threading.Lock()
_CACHE: dict[str, tuple[float, any]] = {}
CACHE_TTL = 600.0
MAX_CACHE_SIZE = 1000


def _get_from_cache(key: str):
    with _CACHE_LOCK:
        if key in _CACHE:
            ts, val = _CACHE[key]
            if time.time() - ts < CACHE_TTL:
                return val
            del _CACHE[key]
    return None


def _set_cache(key: str, val: any):
    with _CACHE_LOCK:
        if len(_CACHE) >= MAX_CACHE_SIZE:
            now = time.time()
            expired = [k for k, (ts, _) in _CACHE.items() if now - ts >= CACHE_TTL]
            for k in expired:
                del _CACHE[k]
            if len(_CACHE) >= MAX_CACHE_SIZE:
                # Remove os 20% mais antigos
                oldest_keys = sorted(_CACHE.keys(), key=lambda k: _CACHE[k][0])[: int(MAX_CACHE_SIZE * 0.2)]
                for k in oldest_keys:
                    _CACHE.pop(k, None)
        _CACHE[key] = (time.time(), val)


def _fmt(m: dict, default_media_type: str = "movie") -> dict:
    media_type = m.get("media_type") or default_media_type
    poster = m.get("poster_path")
    backdrop = m.get("backdrop_path")
    title = m.get("title") or m.get("name") or m.get("original_title") or m.get("original_name") or ""
    release_date = m.get("release_date") or m.get("first_air_date") or ""

    return {
        "id": m.get("id", 0),
        "tmdb_id": m.get("id", 0),
        "title": title,
        "release_date": release_date,
        "poster_url": f"{TMDB_IMAGE_BASE}{poster}" if poster else "",
        "backdrop_url": f"https://image.tmdb.org/t/p/w1280{backdrop}" if backdrop else "",
        "overview": m.get("overview", ""),
        "tmdb_vote_average": float(m.get("vote_average", 0.0)),
        "genre_ids": m.get("genre_ids", []),
        "media_type": media_type,
    }


def search_movies(query: str, page: int = 1) -> dict:
    """Busca unificada para filmes, séries e animes no catálogo TMDb."""
    if not API_KEY or not query.strip():
        return {"page": 1, "total_pages": 1, "total_results": 0, "results": []}

    cache_key = f"search:{query.strip().lower()}:{page}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    try:
        # Busca multi que inclui filmes e séries (incluindo animes)
        data = tmdb.Search().multi(query=query.strip(), page=page, language="pt-BR")
        raw_results = data.get("results", [])

        # FILTRO OBRIGATÓRIO:
        # 1. Apenas mídias do tipo 'movie' ou 'tv' (ignora pessoas/artistas)
        # 2. Exclui resultados sem poster válido
        filtered = [
            m for m in raw_results
            if m.get("media_type") in ("movie", "tv")
            and m.get("poster_path") and str(m.get("poster_path")).strip()
        ]

        results = [_fmt(m) for m in filtered]
        payload = {
            "page": data.get("page", 1),
            "total_pages": data.get("total_pages", 1),
            "total_results": len(results) if data.get("total_pages", 1) == 1 else data.get("total_results", len(results)),
            "results": results,
        }
        _set_cache(cache_key, payload)
        return payload
    except (requests.RequestException, KeyError, ValueError):
        pass

    return {"page": 1, "total_pages": 1, "total_results": 0, "results": []}


def get_trending_movies(time_window: str = "week", page: int = 1) -> dict:
    if not API_KEY:
        return {"page": 1, "total_pages": 1, "total_results": 0, "results": []}

    cache_key = f"trending:{time_window}:{page}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    try:
        data = tmdb.Trending(media_type="movie", time_window=time_window).info(page=page, language="pt-BR")
        raw_results = data.get("results", [])
        # Filtrar apenas com poster
        filtered = [m for m in raw_results if m.get("poster_path") and str(m.get("poster_path")).strip()]
        results = [_fmt(m, default_media_type="movie") for m in filtered]
        payload = {
            "page": data.get("page", 1),
            "total_pages": data.get("total_pages", 1),
            "total_results": data.get("total_results", len(results)),
            "results": results,
        }
        _set_cache(cache_key, payload)
        return payload
    except (requests.RequestException, KeyError, ValueError):
        pass

    return {"page": 1, "total_pages": 1, "total_results": 0, "results": []}


def get_now_playing_movies(page: int = 1) -> dict:
    """Retorna os filmes atualmente em cartaz nos cinemas."""
    if not API_KEY:
        return {"page": 1, "total_pages": 1, "total_results": 0, "results": []}

    cache_key = f"now_playing:{page}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    try:
        data = tmdb.Movies().now_playing(page=page, language="pt-BR")
        raw_results = data.get("results", [])
        filtered = [m for m in raw_results if m.get("poster_path") and str(m.get("poster_path")).strip()]
        results = [_fmt(m, default_media_type="movie") for m in filtered]
        payload = {
            "page": data.get("page", 1),
            "total_pages": data.get("total_pages", 1),
            "total_results": data.get("total_results", len(results)),
            "results": results,
        }
        _set_cache(cache_key, payload)
        return payload
    except (requests.RequestException, KeyError, ValueError):
        pass

    return {"page": 1, "total_pages": 1, "total_results": 0, "results": []}


def get_trending_tv(time_window: str = "week", page: int = 1) -> dict:
    """Retorna as séries de TV em alta na semana ou no dia."""
    if not API_KEY:
        return {"page": 1, "total_pages": 1, "total_results": 0, "results": []}

    cache_key = f"trending_tv:{time_window}:{page}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    try:
        data = tmdb.Trending(media_type="tv", time_window=time_window).info(page=page, language="pt-BR")
        raw_results = data.get("results", [])
        filtered = [m for m in raw_results if m.get("poster_path") and str(m.get("poster_path")).strip()]
        results = [_fmt(m, default_media_type="tv") for m in filtered]
        payload = {
            "page": data.get("page", 1),
            "total_pages": data.get("total_pages", 1),
            "total_results": data.get("total_results", len(results)),
            "results": results,
        }
        _set_cache(cache_key, payload)
        return payload
    except (requests.RequestException, KeyError, ValueError):
        pass

    return {"page": 1, "total_pages": 1, "total_results": 0, "results": []}


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
            _fmt(item, default_media_type=media_type)
            for item in rec_data.get("results", [])
            if item.get("poster_path")
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
            from criticbox_sd.server import database
            user_reviews = database.get_reviews_by_user(str(user_id).strip())
            reviewed_ids = {r["tmdb_id"] for r in user_reviews}

            # Filtrar as melhores avaliações do usuário (nota >= 3.0)
            positive_reviews = [r for r in user_reviews if r.get("rating", 0) >= 3.0]
            positive_reviews.sort(key=lambda x: (x.get("rating", 0), x.get("created_at", "")), reverse=True)

            # Obter sementes distintas para garantir diversidade
            seen_seed_ids = set()
            unique_seeds = []
            for r in positive_reviews:
                tid = r["tmdb_id"]
                if tid not in seen_seed_ids:
                    seen_seed_ids.add(tid)
                    unique_seeds.append(r)

            # Pegar até 8 títulos únicos com as maiores notas do usuário
            top_seeds = unique_seeds[:8]

            # Buscar recomendações de todas as seeds em paralelo
            # + buscar genre_ids das seeds em paralelo para scoring
            if top_seeds:
                def _fetch_for_seed(seed):
                    tid = seed["tmdb_id"]
                    m_type = seed.get("media_type") or "movie"
                    recs = _fetch_seed_recommendations(tid, m_type, page=page)
                    # Tentar obter genre_ids da seed do cache de detalhes
                    seed_genre_ids = []
                    detail_cache_key = f"details:{m_type}:{tid}"
                    cached_detail = _get_from_cache(detail_cache_key)
                    if cached_detail:
                        # get_movie_details retorna 'genres' como lista de nomes, mas _fmt retorna 'genre_ids'
                        seed_genre_ids = cached_detail.get("genre_ids", [])
                    return seed, recs, seed_genre_ids

                with ThreadPoolExecutor(max_workers=min(len(top_seeds), 8)) as executor:
                    futures = [executor.submit(_fetch_for_seed, s) for s in top_seeds]
                    for fut in futures:
                        try:
                            seed, items, seed_gids = fut.result(timeout=4.0)
                            if items:
                                seed_recs_lists.append(items)
                            # Acumular afinidade de gênero a partir dos gêneros das seeds
                            rating = seed.get("rating", 3.0)
                            for gid in seed_gids:
                                genre_scores[gid] = genre_scores.get(gid, 0) + rating
                            # Também inferir gêneros a partir das recomendações (mais itens com esses gêneros = mais relevância)
                            if not seed_gids and items:
                                for item in items[:3]:
                                    for gid in item.get("genre_ids", []):
                                        genre_scores[gid] = genre_scores.get(gid, 0) + (rating * 0.3)
                        except Exception:
                            pass

        except Exception as e:
            logger.warning("Falha ao calcular recomendações para user %s: %s", user_id, e)

    # Intercalar (Round-Robin) entre todas as sementes para diversidade
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

    # Ranquear por afinidade de gênero (se o usuário tiver histórico)
    if genre_scores and interleaved_recs:
        def _genre_affinity(item):
            gids = item.get("genre_ids", [])
            return sum(genre_scores.get(gid, 0) for gid in gids)

        interleaved_recs.sort(key=_genre_affinity, reverse=True)

    # Se não houver recomendações suficientes, fallback para top-rated
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


def discover_by_genre(genre_id: int, page: int = 1) -> dict:
    """Explora filmes/títulos por gênero real no catálogo TMDb."""
    if not API_KEY:
        return {"page": 1, "total_pages": 1, "total_results": 0, "results": []}

    cache_key = f"genre:{genre_id}:{page}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    try:
        data = tmdb.Discover().movie(
            with_genres=genre_id,
            page=page,
            language="pt-BR",
            sort_by="popularity.desc",
        )
        raw_results = data.get("results", [])
        filtered = [m for m in raw_results if m.get("poster_path") and str(m.get("poster_path")).strip()]
        results = [_fmt(m, default_media_type="movie") for m in filtered]
        payload = {
            "page": data.get("page", 1),
            "total_pages": data.get("total_pages", 1),
            "total_results": data.get("total_results", len(results)),
            "results": results,
        }
        _set_cache(cache_key, payload)
        return payload
    except (requests.RequestException, KeyError, ValueError):
        pass

    return {"page": 1, "total_pages": 1, "total_results": 0, "results": []}


def _extract_certification(data: dict, is_movie: bool = True) -> str:
    if is_movie:
        releases = data.get("release_dates", {}).get("results", [])
        for r in releases:
            if r.get("iso_3166_1") == "BR":
                for rd in r.get("release_dates", []):
                    c = (rd.get("certification") or "").strip()
                    if c:
                        return c
        for r in releases:
            if r.get("iso_3166_1") == "US":
                for rd in r.get("release_dates", []):
                    c = (rd.get("certification") or "").strip()
                    if c:
                        return c
    else:
        ratings = data.get("content_ratings", {}).get("results", [])
        for r in ratings:
            if r.get("iso_3166_1") == "BR":
                c = (r.get("rating") or "").strip()
                if c:
                    return c
        for r in ratings:
            if r.get("iso_3166_1") == "US":
                c = (r.get("rating") or "").strip()
                if c:
                    return c
    return ""


def _extract_crew(crew_list: list) -> dict:
    writers = list(dict.fromkeys([
        c.get("name", "") for c in crew_list
        if c.get("job") in ("Screenplay", "Writer", "Story", "Author", "Comic Book", "Characters", "Teleplay") and c.get("name")
    ]))[:8]
    music_composers = list(dict.fromkeys([
        c.get("name", "") for c in crew_list
        if c.get("job") in ("Original Music Composer", "Music", "Score", "Music Producer", "Composer") and c.get("name")
    ]))[:6]
    cinematographers = list(dict.fromkeys([
        c.get("name", "") for c in crew_list
        if c.get("job") in ("Director of Photography", "Cinematography", "Camera Operator") and c.get("name")
    ]))[:6]
    producers = list(dict.fromkeys([
        c.get("name", "") for c in crew_list
        if c.get("job") in ("Producer", "Executive Producer") and c.get("name")
    ]))[:8]
    return {
        "writers": writers,
        "music_composers": music_composers,
        "cinematographers": cinematographers,
        "producers": producers,
    }


def _extract_watch_providers(providers_data: dict) -> dict:
    br = providers_data.get("results", {}).get("BR", {})
    def fmt(lst):
        seen = set()
        res = []
        for p in lst:
            name = (p.get("provider_name") or "").strip()
            if name and name not in seen:
                seen.add(name)
                logo = p.get("logo_path") or ""
                res.append({
                    "provider_name": name,
                    "logo_url": f"https://image.tmdb.org/t/p/w92{logo}" if logo else "",
                })
        return res
    return {
        "flatrate": fmt(br.get("flatrate", [])),
        "rent": fmt(br.get("rent", [])),
        "buy": fmt(br.get("buy", [])),
    }


def _extract_photos_and_logo(images_data: dict) -> tuple[str, list[str]]:
    logos = images_data.get("logos", [])
    logo_url = ""
    best_logos = [l for l in logos if l.get("iso_639_1") in ("pt", "en")] or logos
    if best_logos:
        best_logo = sorted(best_logos, key=lambda x: x.get("vote_average", 0), reverse=True)[0]
        lpath = best_logo.get("file_path")
        if lpath:
            logo_url = f"https://image.tmdb.org/t/p/w500{lpath}"

    backdrops = images_data.get("backdrops", [])[:12]
    photos = [
        f"https://image.tmdb.org/t/p/w1280{b['file_path']}"
        for b in backdrops if b.get("file_path")
    ]
    return logo_url, photos


def _extract_recommendations(recs_data: dict, default_media_type: str = "movie") -> list[dict]:
    raw_results = recs_data.get("results", [])
    filtered = [m for m in raw_results if m.get("poster_path") and str(m.get("poster_path")).strip()]
    return [_fmt(m, default_media_type=default_media_type) for m in filtered[:12]]


def _extract_production_companies(companies_list: list) -> list[dict]:
    res = []
    for c in companies_list[:8]:
        name = c.get("name") or ""
        if name:
            logo = c.get("logo_path") or ""
            res.append({
                "name": name,
                "logo_url": f"https://image.tmdb.org/t/p/w185{logo}" if logo else "",
                "origin_country": c.get("origin_country") or "",
            })
    return res


def get_movie_details(tmdb_id: int, media_type: str = "") -> dict | None:
    if not API_KEY:
        return None

    cache_key = f"details:{media_type}:{tmdb_id}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    # Se explicitamente marcado como 'tv' ou se tentar filme primeiro e der erro
    if media_type == "tv":
        tv_details = _get_tv_details(tmdb_id)
        if tv_details:
            _set_cache(cache_key, tv_details)
            return tv_details

    # Tenta buscar como filme
    try:
        movie_obj = tmdb.Movies(tmdb_id)
        data = movie_obj.info(
            append_to_response="credits,videos,images,release_dates,watch/providers,recommendations",
            language="pt-BR",
            include_video_language="pt,en,null",
        )
        res = _fmt(data, default_media_type="movie")

        # Diretores
        crew = data.get("credits", {}).get("crew", [])
        directors = [c.get("name", "") for c in crew if c.get("job") == "Director" and c.get("name")]
        directors = list(dict.fromkeys(directors))
        crew_details = _extract_crew(crew)

        # Elenco completo
        cast_list = []
        for c in data.get("credits", {}).get("cast", []):
            if not c.get("name"):
                continue
            profile_path = c.get("profile_path")
            cast_list.append(
                {
                    "name": c.get("name", ""),
                    "character": c.get("character", ""),
                    "profile_url": f"https://image.tmdb.org/t/p/w185{profile_path}" if profile_path else "",
                }
            )

        # Trailer (YouTube): busca trailer em português primeiro, com fallback para inglês na mesma resposta
        videos = data.get("videos", {}).get("results", [])
        trailer_url = ""
        for v in videos:
            if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser") and v.get("key"):
                if v.get("iso_639_1") == "pt":
                    trailer_url = f"https://www.youtube.com/watch?v={v['key']}"
                    break
        if not trailer_url:
            for v in videos:
                if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser") and v.get("key"):
                    trailer_url = f"https://www.youtube.com/watch?v={v['key']}"
                    break

        logo_url, photos = _extract_photos_and_logo(data.get("images", {}))
        cert = _extract_certification(data, is_movie=True)
        wp = _extract_watch_providers(data.get("watch/providers", {}))
        recs = _extract_recommendations(data.get("recommendations", {}), default_media_type="movie")
        companies = _extract_production_companies(data.get("production_companies", []))
        countries = [c.get("name", "") for c in data.get("production_countries", []) if c.get("name")]
        spoken = [l.get("name") or l.get("english_name", "") for l in data.get("spoken_languages", []) if (l.get("name") or l.get("english_name"))]

        res.update(
            {
                "genres": [g.get("name", "") for g in data.get("genres", [])],
                "runtime": data.get("runtime", 0) or 0,
                "tagline": data.get("tagline", "") or "",
                "directors": directors,
                "cast": cast_list,
                "trailer_url": trailer_url,
                "media_type": "movie",
                "number_of_seasons": 0,
                "number_of_episodes": 0,
                "seasons": [],
                "original_title": data.get("original_title") or "",
                "original_language": data.get("original_language") or "",
                "spoken_languages": spoken,
                "certification": cert,
                "vote_count": int(data.get("vote_count", 0)),
                "popularity": float(data.get("popularity", 0.0)),
                "budget": int(data.get("budget", 0)),
                "revenue": int(data.get("revenue", 0)),
                "status": data.get("status") or "",
                "imdb_id": data.get("imdb_id") or "",
                "homepage": data.get("homepage") or "",
                "logo_url": logo_url,
                "photos": photos,
                "writers": crew_details["writers"],
                "music_composers": crew_details["music_composers"],
                "cinematographers": crew_details["cinematographers"],
                "producers": crew_details["producers"],
                "production_companies": companies,
                "production_countries": countries,
                "networks": [],
                "watch_providers": wp,
                "recommendations": recs,
                "last_episode_to_air": None,
                "next_episode_to_air": None,
                "first_air_date": data.get("release_date") or "",
                "last_air_date": data.get("release_date") or "",
            }
        )
        _set_cache(cache_key, res)
        return res
    except (requests.RequestException, KeyError, ValueError):
        # Fallback para TV se a busca por filme falhou
        tv_details = _get_tv_details(tmdb_id)
        if tv_details:
            _set_cache(cache_key, tv_details)
            return tv_details

    return None


def _get_tv_details(tmdb_id: int) -> dict | None:
    try:
        tv_obj = tmdb.TV(tmdb_id)
        data = tv_obj.info(
            append_to_response="credits,videos,images,content_ratings,watch/providers,recommendations",
            language="pt-BR",
            include_video_language="pt,en,null",
        )
        res = _fmt(data, default_media_type="tv")

        # Criadores / Diretores
        creators = [c.get("name", "") for c in data.get("created_by", []) if c.get("name")]
        if not creators:
            crew = data.get("credits", {}).get("crew", [])
            creators = [c.get("name", "") for c in crew if c.get("job") in ("Director", "Executive Producer") and c.get("name")]
        creators = list(dict.fromkeys(creators))
        crew = data.get("credits", {}).get("crew", [])
        crew_details = _extract_crew(crew)

        # Elenco completo
        cast_list = []
        for c in data.get("credits", {}).get("cast", []):
            if not c.get("name"):
                continue
            profile_path = c.get("profile_path")
            cast_list.append(
                {
                    "name": c.get("name", ""),
                    "character": c.get("character", ""),
                    "profile_url": f"https://image.tmdb.org/t/p/w185{profile_path}" if profile_path else "",
                }
            )

        # Trailer: busca trailer em português primeiro, com fallback para inglês na mesma resposta
        videos = data.get("videos", {}).get("results", [])
        trailer_url = ""
        for v in videos:
            if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser") and v.get("key"):
                if v.get("iso_639_1") == "pt":
                    trailer_url = f"https://www.youtube.com/watch?v={v['key']}"
                    break
        if not trailer_url:
            for v in videos:
                if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser") and v.get("key"):
                    trailer_url = f"https://www.youtube.com/watch?v={v['key']}"
                    break

        # Temporadas (ignora especiais season_number 0 para simplificar escolha de temporadas)
        raw_seasons = data.get("seasons", [])
        seasons = [
            {
                "season_number": s.get("season_number", 1),
                "name": s.get("name") or f"Temporada {s.get('season_number', 1)}",
                "episode_count": s.get("episode_count", 0),
                "poster_url": f"{TMDB_IMAGE_BASE}{s.get('poster_path')}" if s.get("poster_path") else "",
            }
            for s in raw_seasons
            if s.get("season_number", 0) > 0
        ]

        episode_run_times = data.get("episode_run_time", [])
        runtime = episode_run_times[0] if episode_run_times else 0

        logo_url, photos = _extract_photos_and_logo(data.get("images", {}))
        cert = _extract_certification(data, is_movie=False)
        wp = _extract_watch_providers(data.get("watch/providers", {}))
        recs = _extract_recommendations(data.get("recommendations", {}), default_media_type="tv")
        companies = _extract_production_companies(data.get("production_companies", []))
        countries = [c.get("name", "") for c in data.get("production_countries", []) if c.get("name")]
        spoken = [l.get("name") or l.get("english_name", "") for l in data.get("spoken_languages", []) if (l.get("name") or l.get("english_name"))]

        networks = []
        for n in data.get("networks", []):
            name = n.get("name") or ""
            if name:
                logo = n.get("logo_path") or ""
                networks.append({
                    "name": name,
                    "logo_url": f"https://image.tmdb.org/t/p/w185{logo}" if logo else "",
                })

        last_ep_raw = data.get("last_episode_to_air") or {}
        last_ep = None
        if last_ep_raw and last_ep_raw.get("name"):
            last_ep = {
                "name": last_ep_raw.get("name", ""),
                "episode_number": last_ep_raw.get("episode_number", 0),
                "season_number": last_ep_raw.get("season_number", 0),
                "air_date": last_ep_raw.get("air_date", ""),
                "overview": last_ep_raw.get("overview", ""),
                "still_url": f"https://image.tmdb.org/t/p/w300{last_ep_raw.get('still_path')}" if last_ep_raw.get("still_path") else "",
                "vote_average": float(last_ep_raw.get("vote_average", 0.0)),
            }

        next_ep_raw = data.get("next_episode_to_air") or {}
        next_ep = None
        if next_ep_raw and next_ep_raw.get("name"):
            next_ep = {
                "name": next_ep_raw.get("name", ""),
                "episode_number": next_ep_raw.get("episode_number", 0),
                "season_number": next_ep_raw.get("season_number", 0),
                "air_date": next_ep_raw.get("air_date", ""),
                "overview": next_ep_raw.get("overview", ""),
                "still_url": f"https://image.tmdb.org/t/p/w300{next_ep_raw.get('still_path')}" if next_ep_raw.get("still_path") else "",
                "vote_average": float(next_ep_raw.get("vote_average", 0.0)),
            }

        res.update(
            {
                "genres": [g.get("name", "") for g in data.get("genres", [])],
                "runtime": runtime,
                "tagline": data.get("tagline", "") or "",
                "directors": creators,
                "cast": cast_list,
                "trailer_url": trailer_url,
                "media_type": "tv",
                "number_of_seasons": data.get("number_of_seasons", len(seasons)),
                "number_of_episodes": data.get("number_of_episodes", 0),
                "seasons": seasons,
                "original_title": data.get("original_name") or "",
                "original_language": data.get("original_language") or "",
                "spoken_languages": spoken,
                "certification": cert,
                "vote_count": int(data.get("vote_count", 0)),
                "popularity": float(data.get("popularity", 0.0)),
                "budget": 0,
                "revenue": 0,
                "status": data.get("status") or "",
                "imdb_id": data.get("imdb_id") or "",
                "homepage": data.get("homepage") or "",
                "logo_url": logo_url,
                "photos": photos,
                "writers": crew_details["writers"],
                "music_composers": crew_details["music_composers"],
                "cinematographers": crew_details["cinematographers"],
                "producers": crew_details["producers"],
                "production_companies": companies,
                "production_countries": countries,
                "networks": networks,
                "watch_providers": wp,
                "recommendations": recs,
                "last_episode_to_air": last_ep,
                "next_episode_to_air": next_ep,
                "first_air_date": data.get("first_air_date") or "",
                "last_air_date": data.get("last_air_date") or "",
            }
        )
        return res
    except Exception:
        return None


def get_season_episodes(tmdb_id: int, season_number: int) -> dict:
    if not API_KEY:
        return {"season_number": season_number, "name": f"Temporada {season_number}", "poster_url": "", "episodes": []}
    cache_key = f"episodes:{tmdb_id}:{season_number}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    try:
        data = tmdb.TV_Seasons(tmdb_id, season_number).info(language="pt-BR")
        poster_path = data.get("poster_path")
        poster_url = f"{TMDB_IMAGE_BASE}{poster_path}" if poster_path else ""
        episodes = []
        for ep in data.get("episodes", []):
            ep_crew = ep.get("crew", [])
            directors = list(dict.fromkeys([c.get("name", "") for c in ep_crew if c.get("job") == "Director" and c.get("name")]))
            writers = list(dict.fromkeys([c.get("name", "") for c in ep_crew if c.get("job") in ("Writer", "Screenplay", "Teleplay") and c.get("name")]))
            guest_stars = [
                {
                    "name": g.get("name", ""),
                    "character": g.get("character", ""),
                    "profile_url": f"https://image.tmdb.org/t/p/w185{g.get('profile_path')}" if g.get("profile_path") else "",
                }
                for g in ep.get("guest_stars", [])[:6]
            ]
            episodes.append(
                {
                    "episode_number": ep.get("episode_number"),
                    "name": ep.get("name") or f"Episódio {ep.get('episode_number')}",
                    "overview": ep.get("overview") or "",
                    "air_date": ep.get("air_date") or "",
                    "vote_average": round(float(ep.get("vote_average", 0.0)), 1),
                    "still_url": f"https://image.tmdb.org/t/p/w500{ep.get('still_path')}" if ep.get("still_path") else "",
                    "runtime": ep.get("runtime", 0) or 0,
                    "directors": directors,
                    "writers": writers,
                    "guest_stars": guest_stars,
                }
            )
        result = {
            "season_number": season_number,
            "name": data.get("name") or f"Temporada {season_number}",
            "poster_url": poster_url,
            "episodes": episodes,
        }
        _set_cache(cache_key, result)
        return result
    except Exception:
        return {"season_number": season_number, "name": f"Temporada {season_number}", "poster_url": "", "episodes": []}


def get_all_series_episodes(tmdb_id: int, seasons_hint: list | None = None) -> dict[str, list[dict]]:
    """Busca todos os episódios de todas as temporadas de uma série em paralelo e retorna indexado por temporada."""
    if not API_KEY:
        return {}
    cache_key = f"all_episodes:{tmdb_id}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    try:
        season_numbers = []
        if seasons_hint:
            for s in seasons_hint:
                if isinstance(s, dict):
                    sn = s.get("season_number", 0)
                elif isinstance(s, int):
                    sn = s
                else:
                    sn = 0
                if sn > 0:
                    season_numbers.append(sn)

        if not season_numbers:
            tv_details = _get_tv_details(tmdb_id)
            raw_seasons = tv_details.get("seasons", []) if tv_details else []
            season_numbers = [s["season_number"] for s in raw_seasons if s.get("season_number", 0) > 0]

        if not season_numbers:
            tv_obj = tmdb.TV(tmdb_id)
            info = tv_obj.info(language="pt-BR")
            season_numbers = [s["season_number"] for s in info.get("seasons", []) if s.get("season_number", 0) > 0]

        if not season_numbers:
            season_numbers = [1]

        def fetch_season(s_num: int):
            return s_num, get_season_episodes(tmdb_id, s_num)

        result: dict[str, list[dict]] = {}
        with ThreadPoolExecutor(max_workers=min(len(season_numbers), 10)) as executor:
            futures = [executor.submit(fetch_season, s_num) for s_num in season_numbers]
            for fut in futures:
                s_num, s_data = fut.result()
                result[str(s_num)] = s_data.get("episodes", [])

        _set_cache(cache_key, result)
        return result
    except Exception:
        return {}


def get_movie_title(tmdb_id: int, media_type: str = "movie") -> str:
    m_type = media_type or "movie"
    cache_key = f"title:{m_type}:{tmdb_id}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    details = get_movie_details(tmdb_id, media_type=m_type)
    if details and details.get("title"):
        _set_cache(cache_key, details["title"])
        return details["title"]
    fallback = f"Título #{tmdb_id}"
    return fallback


def get_genres() -> list[dict]:
    """Retorna todos os gêneros únicos de filmes e séries disponíveis no TMDb em pt-BR."""
    cached = _get_from_cache("all_genres")
    if cached is not None:
        return cached

    try:
        m_genres = tmdb.Genres().movie_list(language="pt-BR").get("genres", [])
        tv_genres = tmdb.Genres().tv_list(language="pt-BR").get("genres", [])

        combined_dict = {}
        for g in m_genres + tv_genres:
            gid = g.get("id")
            name = g.get("name")
            if gid and name and gid not in combined_dict:
                combined_dict[gid] = {"id": gid, "name": name}

        result = sorted(list(combined_dict.values()), key=lambda x: x["name"])
        _set_cache("all_genres", result)
        return result
    except Exception:
        return []


