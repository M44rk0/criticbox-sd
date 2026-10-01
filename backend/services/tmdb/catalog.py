import logging
from concurrent.futures import ThreadPoolExecutor

import requests
import tmdbsimple as tmdb

from services.tmdb.cache import _get_from_cache, _set_cache
from services.tmdb.client import API_KEY, TMDB_IMAGE_BASE
from services.tmdb.extractors import (
    _extract_certification,
    _extract_crew,
    _extract_photos_and_logo,
    _extract_recommendations,
    _extract_watch_providers,
    _fmt,
)

logger = logging.getLogger("criticbox-tmdb-catalog")


def search_movies(query: str, page: int = 1) -> dict:
    """Busca unificada para filmes, séries e animes no catálogo TMDb."""
    if not API_KEY or not query.strip():
        return {"page": 1, "total_pages": 1, "total_results": 0, "results": []}

    cache_key = f"search:{query.strip().lower()}:{page}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    try:
        data = tmdb.Search().multi(query=query.strip(), page=page, language="pt-BR")
        raw_results = data.get("results", [])

        filtered = [
            m
            for m in raw_results
            if m.get("media_type") in ("movie", "tv") and m.get("poster_path") and str(m.get("poster_path")).strip()
        ]

        results = [_fmt(m) for m in filtered]
        payload = {
            "page": data.get("page", 1),
            "total_pages": data.get("total_pages", 1),
            "total_results": len(results)
            if data.get("total_pages", 1) == 1
            else data.get("total_results", len(results)),
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


def get_movie_details(tmdb_id: int, media_type: str = "") -> dict | None:
    if not API_KEY:
        return None

    cache_key = f"details:{media_type}:{tmdb_id}"
    cached = _get_from_cache(cache_key)
    if cached:
        return cached

    if media_type == "tv":
        tv_details = _get_tv_details(tmdb_id)
        if tv_details:
            _set_cache(cache_key, tv_details)
            return tv_details

    try:
        movie_obj = tmdb.Movies(tmdb_id)
        data = movie_obj.info(
            append_to_response="credits,videos,images,release_dates,watch/providers,recommendations",
            language="pt-BR",
            include_video_language="pt,en,null",
        )
        res = _fmt(data, default_media_type="movie")

        crew = data.get("credits", {}).get("crew", [])
        directors = [c.get("name", "") for c in crew if c.get("job") == "Director" and c.get("name")]
        directors = list(dict.fromkeys(directors))
        crew_details = _extract_crew(crew)

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
        countries = [c.get("name", "") for c in data.get("production_countries", []) if c.get("name")]
        spoken = [
            lang.get("name") or lang.get("english_name", "")
            for lang in data.get("spoken_languages", [])
            if (lang.get("name") or lang.get("english_name"))
        ]

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

        creators = [c.get("name", "") for c in data.get("created_by", []) if c.get("name")]
        if not creators:
            crew = data.get("credits", {}).get("crew", [])
            creators = [
                c.get("name", "") for c in crew if c.get("job") in ("Director", "Executive Producer") and c.get("name")
            ]
        creators = list(dict.fromkeys(creators))
        crew = data.get("credits", {}).get("crew", [])
        crew_details = _extract_crew(crew)

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
        countries = [c.get("name", "") for c in data.get("production_countries", []) if c.get("name")]
        spoken = [
            lang.get("name") or lang.get("english_name", "")
            for lang in data.get("spoken_languages", [])
            if (lang.get("name") or lang.get("english_name"))
        ]

        networks = []
        for n in data.get("networks", []):
            name = n.get("name") or ""
            if name:
                logo = n.get("logo_path") or ""
                networks.append(
                    {
                        "name": name,
                        "logo_url": f"https://image.tmdb.org/t/p/w185{logo}" if logo else "",
                    }
                )

        last_ep_raw = data.get("last_episode_to_air") or {}
        last_ep = None
        if last_ep_raw and last_ep_raw.get("name"):
            last_ep = {
                "name": last_ep_raw.get("name", ""),
                "episode_number": last_ep_raw.get("episode_number", 0),
                "season_number": last_ep_raw.get("season_number", 0),
                "air_date": last_ep_raw.get("air_date", ""),
                "overview": last_ep_raw.get("overview", ""),
                "still_url": f"https://image.tmdb.org/t/p/w300{last_ep_raw.get('still_path')}"
                if last_ep_raw.get("still_path")
                else "",
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
                "still_url": f"https://image.tmdb.org/t/p/w300{next_ep_raw.get('still_path')}"
                if next_ep_raw.get("still_path")
                else "",
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
            directors = list(
                dict.fromkeys([c.get("name", "") for c in ep_crew if c.get("job") == "Director" and c.get("name")])
            )
            writers = list(
                dict.fromkeys(
                    [
                        c.get("name", "")
                        for c in ep_crew
                        if c.get("job") in ("Writer", "Screenplay", "Teleplay") and c.get("name")
                    ]
                )
            )
            guest_stars = [
                {
                    "name": g.get("name", ""),
                    "character": g.get("character", ""),
                    "profile_url": f"https://image.tmdb.org/t/p/w185{g.get('profile_path')}"
                    if g.get("profile_path")
                    else "",
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
                    "still_url": f"https://image.tmdb.org/t/p/w500{ep.get('still_path')}"
                    if ep.get("still_path")
                    else "",
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
