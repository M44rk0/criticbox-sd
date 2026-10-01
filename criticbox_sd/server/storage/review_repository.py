import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func, or_, select, update

from criticbox_sd.server.storage.connection import get_session
from criticbox_sd.server.storage.models import Review


def _format_review_row(r: Any) -> dict:
    if isinstance(r, Review):
        return {
            "review_id": r.id,
            "tmdb_id": r.tmdb_id,
            "movie_title": r.movie_title or "",
            "user_id": r.user_id,
            "username": r.username or r.user_id,
            "rating": float(r.rating),
            "comment": r.comment or "",
            "contains_spoilers": bool(r.contains_spoilers),
            "created_at": str(r.created_at),
            "media_type": r.media_type or "movie",
            "season_number": int(r.season_number or 0),
            "episode_number": int(r.episode_number or 0),
            "poster_url": r.poster_url or "",
            "success": True,
            "message": "",
        }

    keys = r.keys() if hasattr(r, "keys") else []
    media_type = r["media_type"] if "media_type" in keys and r["media_type"] else "movie"
    season_number = r["season_number"] if "season_number" in keys and r["season_number"] is not None else 0
    episode_number = r["episode_number"] if "episode_number" in keys and r["episode_number"] is not None else 0
    movie_title = r["movie_title"] if "movie_title" in keys and r["movie_title"] else ""
    poster_url = r["poster_url"] if "poster_url" in keys and r["poster_url"] else ""
    user_id = r["user_id"] if "user_id" in keys and r["user_id"] else ""
    username = r["username"] if "username" in keys and r["username"] else user_id

    return {
        "review_id": r["id"],
        "tmdb_id": r["tmdb_id"],
        "movie_title": movie_title,
        "user_id": user_id,
        "username": username,
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
    username: str = "",
) -> dict:
    media_type = media_type or "movie"
    username = username or user_id

    with get_session() as session:
        user_cond = or_(Review.user_id == user_id, and_(Review.username != "", Review.username == username))
        if media_type == "movie":
            stmt = select(Review.id).where(
                Review.tmdb_id == tmdb_id,
                user_cond,
                or_(Review.media_type == "movie", Review.media_type.is_(None)),
            )
        else:
            stmt = select(Review.id).where(
                Review.tmdb_id == tmdb_id,
                user_cond,
                Review.media_type == "tv",
                func.coalesce(Review.season_number, 0) == (season_number or 0),
                func.coalesce(Review.episode_number, 0) == (episode_number or 0),
            )

        existing = session.scalar(stmt)
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
                "username": username,
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

        new_review = Review(
            id=review_id,
            tmdb_id=tmdb_id,
            user_id=user_id,
            username=username,
            rating=rating,
            comment=comment,
            contains_spoilers=bool(contains_spoilers),
            created_at=created_at,
            media_type=media_type,
            season_number=season_number,
            episode_number=episode_number,
            movie_title=movie_title or "",
            poster_url=poster_url or "",
        )
        session.add(new_review)

    return {
        "review_id": review_id,
        "tmdb_id": tmdb_id,
        "user_id": user_id,
        "username": username,
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
    with get_session() as session:
        session.execute(
            update(Review)
            .where(Review.id == review_id, or_(Review.poster_url == "", Review.poster_url.is_(None)))
            .values(poster_url=poster_url)
        )


def get_movie_stats(tmdb_id: int) -> dict:
    with get_session() as session:
        row = session.execute(
            select(func.avg(Review.rating), func.count(Review.id)).where(Review.tmdb_id == tmdb_id)
        ).one_or_none()
        avg_rating = row[0] if row and row[0] is not None else 0.0
        count = row[1] if row and row[1] is not None else 0
        return {"average_rating": round(float(avg_rating), 1), "total_count": int(count)}


def get_batch_movie_stats(tmdb_ids: list[int]) -> dict[int, dict]:
    if not tmdb_ids:
        return {}
    unique_ids = list(set(tmdb_ids))
    with get_session() as session:
        rows = session.execute(
            select(Review.tmdb_id, func.avg(Review.rating), func.count(Review.id))
            .where(Review.tmdb_id.in_(unique_ids))
            .group_by(Review.tmdb_id)
        ).all()
        stats_map = {}
        for tid, avg, cnt in rows:
            stats_map[tid] = {
                "average_rating": round(float(avg), 1) if avg is not None else 0.0,
                "total_count": int(cnt) if cnt is not None else 0,
            }
        for tid in unique_ids:
            if tid not in stats_map:
                stats_map[tid] = {"average_rating": 0.0, "total_count": 0}
        return stats_map


def get_all_reviews(limit: int = 50) -> list:
    with get_session() as session:
        rows = session.scalars(select(Review).order_by(Review.created_at.desc()).limit(limit)).all()
        return [_format_review_row(r) for r in rows]


def get_reviews_by_movie(tmdb_id: int) -> list:
    with get_session() as session:
        rows = session.scalars(select(Review).where(Review.tmdb_id == tmdb_id).order_by(Review.created_at.desc())).all()
        return [_format_review_row(r) for r in rows]


def get_reviews_by_user(user_id: str = "", username: str = "") -> list:
    target_id = user_id or username
    target_username = username or user_id
    with get_session() as session:
        rows = session.scalars(
            select(Review)
            .where(or_(Review.user_id == target_id, Review.username == target_username))
            .order_by(Review.created_at.desc())
        ).all()
        return [_format_review_row(r) for r in rows]
