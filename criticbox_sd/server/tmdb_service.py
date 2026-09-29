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
        data = movie_obj.info(append_to_response="credits,videos", language="pt-BR")
        res = _fmt(data, default_media_type="movie")

        # Diretores
        crew = data.get("credits", {}).get("crew", [])
        directors = [c.get("name", "") for c in crew if c.get("job") == "Director" and c.get("name")]
        directors = list(dict.fromkeys(directors))

        # Elenco principal
        cast_list = []
        for c in data.get("credits", {}).get("cast", [])[:12]:
            profile_path = c.get("profile_path")
            cast_list.append(
                {
                    "name": c.get("name", ""),
                    "character": c.get("character", ""),
                    "profile_url": f"https://image.tmdb.org/t/p/w185{profile_path}" if profile_path else "",
                }
            )

        # Trailer (YouTube)
        videos = data.get("videos", {}).get("results", [])
        trailer_url = ""
        for v in videos:
            if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser") and v.get("key"):
                trailer_url = f"https://www.youtube.com/watch?v={v['key']}"
                break

        if not trailer_url:
            try:
                en_vids = movie_obj.videos(language="en-US").get("results", [])
                for v in en_vids:
                    if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser") and v.get("key"):
                        trailer_url = f"https://www.youtube.com/watch?v={v['key']}"
                        break
            except Exception:
                pass

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
        data = tv_obj.info(append_to_response="credits,videos", language="pt-BR")
        res = _fmt(data, default_media_type="tv")

        # Criadores / Diretores
        creators = [c.get("name", "") for c in data.get("created_by", []) if c.get("name")]
        if not creators:
            crew = data.get("credits", {}).get("crew", [])
            creators = [c.get("name", "") for c in crew if c.get("job") in ("Director", "Executive Producer") and c.get("name")]
        creators = list(dict.fromkeys(creators))

        # Elenco
        cast_list = []
        for c in data.get("credits", {}).get("cast", [])[:12]:
            profile_path = c.get("profile_path")
            cast_list.append(
                {
                    "name": c.get("name", ""),
                    "character": c.get("character", ""),
                    "profile_url": f"https://image.tmdb.org/t/p/w185{profile_path}" if profile_path else "",
                }
            )

        # Trailer
        videos = data.get("videos", {}).get("results", [])
        trailer_url = ""
        for v in videos:
            if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser") and v.get("key"):
                trailer_url = f"https://www.youtube.com/watch?v={v['key']}"
                break

        if not trailer_url:
            try:
                en_vids = tv_obj.videos(language="en-US").get("results", [])
                for v in en_vids:
                    if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser") and v.get("key"):
                        trailer_url = f"https://www.youtube.com/watch?v={v['key']}"
                        break
            except Exception:
                pass

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
            episodes.append(
                {
                    "episode_number": ep.get("episode_number"),
                    "name": ep.get("name") or f"Episódio {ep.get('episode_number')}",
                    "overview": ep.get("overview") or "",
                    "air_date": ep.get("air_date") or "",
                    "vote_average": float(ep.get("vote_average", 0.0)),
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


def get_all_series_episodes(tmdb_id: int) -> dict[str, list[dict]]:
    """Busca todos os episódios de todas as temporadas de uma série em paralelo e retorna indexado por temporada."""
    if not API_KEY:
        return {}
    cache_key = f"all_episodes:{tmdb_id}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    try:
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


