import uuid
from datetime import datetime, timezone

from criticbox_sd.server.storage.connection import get_connection


def _format_review_row(r) -> dict:
    keys = r.keys() if hasattr(r, "keys") else []
    media_type = r["media_type"] if "media_type" in keys and r["media_type"] else "movie"
    season_number = r["season_number"] if "season_number" in keys and r["season_number"] is not None else 0
    episode_number = r["episode_number"] if "episode_number" in keys and r["episode_number"] is not None else 0
    movie_title = r["movie_title"] if "movie_title" in keys and r["movie_title"] else ""
    poster_url = r["poster_url"] if "poster_url" in keys and r["poster_url"] else ""

    return {
        "review_id": r["id"],
        "tmdb_id": r["tmdb_id"],
        "movie_title": movie_title,
        "user_id": r["user_id"],
        "rating": float(r["rating"]),
        "comment": r["comment"] or "",
        "contains_spoilers": bool(r["contains_spoilers"]),
        "created_at": str(r["created_at"]),
        "media_type": media_type,
        "season_number": int(season_number),
        "episode_number": int(episode_number),
        "poster_url": poster_url,
        "success": True,
        "message": "",
    }


def add_review(
    tmdb_id: int,
    user_id: str,
    rating: float,
    comment: str = "",
    contains_spoilers: bool = False,
    media_type: str = "movie",
    season_number: int | None = None,
    episode_number: int | None = None,
    movie_title: str = "",
    poster_url: str = "",
) -> dict:
    media_type = media_type or "movie"
    with get_connection() as client:
        if media_type == "movie":
            dup_query = "SELECT id FROM reviews WHERE tmdb_id = ? AND user_id = ? AND (media_type = 'movie' OR media_type IS NULL)"
            dup_params = (tmdb_id, user_id)
        else:
            dup_query = """
                SELECT id FROM reviews
                WHERE tmdb_id = ? AND user_id = ? AND media_type = 'tv'
                  AND COALESCE(season_number, 0) = ?
                  AND COALESCE(episode_number, 0) = ?
            """
            dup_params = (tmdb_id, user_id, season_number or 0, episode_number or 0)

        existing = client.execute(dup_query, dup_params).fetchone()
        if existing:
            if media_type == "movie":
                msg = "Você já avaliou este filme. Cada usuário pode enviar apenas uma avaliação por filme."
            elif season_number and episode_number:
                msg = f"Você já avaliou o Episódio {episode_number} da Temporada {season_number}."
            elif season_number:
                msg = f"Você já avaliou a Temporada {season_number} desta série."
            else:
                msg = "Você já avaliou esta série completa."

            return {
                "review_id": "",
                "tmdb_id": tmdb_id,
                "user_id": user_id,
                "rating": 0.0,
                "comment": "",
                "contains_spoilers": False,
                "created_at": "",
                "media_type": media_type,
                "season_number": season_number or 0,
                "episode_number": episode_number or 0,
                "movie_title": movie_title,
                "poster_url": poster_url or "",
                "success": False,
                "message": msg,
            }

        review_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        client.execute(
            "INSERT INTO reviews (id, tmdb_id, user_id, rating, comment, contains_spoilers, created_at, media_type, season_number, episode_number, movie_title, poster_url) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                review_id,
                tmdb_id,
                user_id,
                rating,
                comment,
                int(contains_spoilers),
                created_at,
                media_type,
                season_number,
                episode_number,
                movie_title or "",
                poster_url or "",
            ),
        )
    return {
        "review_id": review_id,
        "tmdb_id": tmdb_id,
        "user_id": user_id,
        "rating": rating,
        "comment": comment,
        "contains_spoilers": contains_spoilers,
        "created_at": created_at,
        "media_type": media_type,
        "season_number": season_number or 0,
        "episode_number": episode_number or 0,
        "movie_title": movie_title,
        "poster_url": poster_url or "",
        "success": True,
        "message": "Review registrada com sucesso!",
    }


def update_review_poster(review_id: str, poster_url: str):
    if not review_id or not poster_url:
        return
    with get_connection() as client:
        client.execute(
            "UPDATE reviews SET poster_url = ? WHERE id = ? AND (poster_url = '' OR poster_url IS NULL)",
            (poster_url, review_id),
        )


def get_movie_stats(tmdb_id: int) -> dict:
    with get_connection() as client:
        row = client.execute(
            "SELECT AVG(rating) AS avg_rating, COUNT(id) AS total_count FROM reviews WHERE tmdb_id = ?",
            (tmdb_id,),
        ).fetchone()
        avg_rating = row["avg_rating"] if row and row["avg_rating"] is not None else 0.0
        count = row["total_count"] if row and row["total_count"] is not None else 0
        return {"average_rating": round(float(avg_rating), 1), "total_count": int(count)}


def get_batch_movie_stats(tmdb_ids: list[int]) -> dict[int, dict]:
    if not tmdb_ids:
        return {}
    unique_ids = list(set(tmdb_ids))
    with get_connection() as client:
        placeholders = ", ".join(["?"] * len(unique_ids))
        query = f"""
            SELECT tmdb_id, AVG(rating) AS avg_rating, COUNT(id) AS total_count
            FROM reviews
            WHERE tmdb_id IN ({placeholders})
            GROUP BY tmdb_id
        """
        rows = client.execute(query, tuple(unique_ids)).fetchall()
        stats_map = {}
        for r in rows:
            tid = r["tmdb_id"]
            avg = r["avg_rating"] if r["avg_rating"] is not None else 0.0
            cnt = r["total_count"] if r["total_count"] is not None else 0
            stats_map[tid] = {"average_rating": round(float(avg), 1), "total_count": int(cnt)}
        for tid in unique_ids:
            if tid not in stats_map:
                stats_map[tid] = {"average_rating": 0.0, "total_count": 0}
        return stats_map


def get_all_reviews(limit: int = 50) -> list:
    with get_connection() as client:
        rows = client.execute(
            "SELECT * FROM reviews ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [_format_review_row(r) for r in rows]


def get_reviews_by_movie(tmdb_id: int) -> list:
    with get_connection() as client:
        rows = client.execute(
            "SELECT * FROM reviews WHERE tmdb_id = ? ORDER BY created_at DESC",
            (tmdb_id,),
        ).fetchall()
        return [_format_review_row(r) for r in rows]


def get_reviews_by_user(user_id: str) -> list:
    with get_connection() as client:
        rows = client.execute(
            "SELECT * FROM reviews WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        return [_format_review_row(r) for r in rows]
