import os

import requests
import tmdbsimple as tmdb
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("TMDB_API_KEY", "").strip()
if API_KEY.startswith("eyJ"):
    tmdb.REQUESTS_SESSION = requests.Session()
    tmdb.REQUESTS_SESSION.headers.update({"Authorization": f"Bearer {API_KEY}"})
tmdb.API_KEY = API_KEY


TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"


def _fmt(m: dict) -> dict:
    poster = m.get("poster_path")
    return {
        "id": m.get("id", 0),
        "title": m.get("title", ""),
        "release_date": m.get("release_date", ""),
        "poster_url": f"{TMDB_IMAGE_BASE}{poster}" if poster else "",
        "overview": m.get("overview", ""),
        "tmdb_vote_average": float(m.get("vote_average", 0.0)),
    }


def search_movies(query: str, page: int = 1) -> dict:
    if API_KEY:
        try:
            data = tmdb.Search().movie(query=query, page=page, language="pt-BR")
            results = [_fmt(m) for m in data.get("results", [])[:5]]
            return {
                "page": data.get("page", 1),
                "total_results": len(results),
                "results": results,
            }
        except (requests.RequestException, KeyError, ValueError):
            pass
    return {"page": 1, "total_results": 0, "results": []}



def get_movie_details(tmdb_id: int) -> dict:
    if API_KEY:
        try:
            data = tmdb.Movies(tmdb_id).info(language="pt-BR")
            res = _fmt(data)
            res.update(
                {
                    "genres": [g.get("name", "") for g in data.get("genres", [])],
                    "runtime": data.get("runtime", 0) or 0,
                }
            )
            return res
        except (requests.RequestException, KeyError, ValueError):
            pass
    return None


_TITLE_CACHE: dict[int, str] = {}


def get_movie_title(tmdb_id: int) -> str:
    if tmdb_id in _TITLE_CACHE:
        return _TITLE_CACHE[tmdb_id]
    details = get_movie_details(tmdb_id)
    if details and details.get("title"):
        _TITLE_CACHE[tmdb_id] = details["title"]
        return details["title"]
    fallback = f"Filme #{tmdb_id}"
    return fallback
