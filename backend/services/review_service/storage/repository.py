import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func, or_, select, update

from services.review_service.storage.connection import get_session
from services.review_service.storage.models import FavoriteItem, Review, WatchedItem


def _user_condition(model, user_id: str, username: str = ""):
    """Gera cláusula de filtro flexível para buscar registros por user_id ou username.

    Suporta identificadores canônicos (UUID), normalização case-insensitive e
    compatibilidade com registros legados onde o identificador pode ser o username.
    """
    conds = []
    uid = (user_id or "").strip()
    uname = (username or "").strip()

    if uid:
        conds.append(model.user_id == uid)
        conds.append(func.lower(model.user_id) == uid.lower())
    if uname:
        conds.append(func.lower(model.username) == uname.lower())
    if uid and not uname:
        conds.append(func.lower(model.username) == uid.lower())

    return or_(*conds) if conds else and_()


def _build_watched_item(
    user_id: str,
    username: str,
    tmdb_id: int,
    media_type: str = "movie",
    movie_title: str = "",
    poster_url: str = "",
    created_at: str = "",
) -> WatchedItem:
    return WatchedItem(
        id=str(uuid.uuid4()),
        user_id=user_id,
        username=username or user_id,
        tmdb_id=int(tmdb_id),
        media_type=media_type or "movie",
        movie_title=movie_title or "",
        poster_url=poster_url or "",
        created_at=created_at or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    )


def _format_activity_item(item: Any, rev: Review | None = None) -> dict:
    return {
        "id": item.id,
        "tmdb_id": int(item.tmdb_id),
        "user_id": item.user_id,
        "username": item.username or item.user_id,
        "media_type": item.media_type or "movie",
        "movie_title": item.movie_title or "",
        "poster_url": item.poster_url or "",
        "created_at": item.created_at,
        "user_rating": float(rev.rating) if rev else 0.0,
        "has_review": bool(rev),
        "review_id": str(rev.id) if rev else "",
    }


def _format_review_row(r: Any) -> dict:
    get_v = (lambda k, d=None: r.get(k, d)) if isinstance(r, dict) else (lambda k, d=None: getattr(r, k, d))
    rev_id = get_v("id") or get_v("review_id", "")
    user_id = get_v("user_id", "") or ""
    username = get_v("username", "") or user_id

    custom_rating = get_v("custom_rating", None)
    if custom_rating is not None:
        try:
            custom_rating = int(custom_rating)
        except (ValueError, TypeError):
            custom_rating = 0
    else:
        custom_rating = 0

    return {
        "review_id": rev_id,
        "tmdb_id": int(get_v("tmdb_id", 0) or 0),
        "movie_title": get_v("movie_title", "") or "",
        "user_id": user_id,
        "username": username,
        "rating": float(get_v("rating", 0.0) or 0.0),
        "comment": get_v("comment", "") or "",
        "contains_spoilers": bool(get_v("contains_spoilers", False)),
        "created_at": str(get_v("created_at", "") or ""),
        "media_type": get_v("media_type", "movie") or "movie",
        "season_number": int(get_v("season_number", 0) or 0),
        "episode_number": int(get_v("episode_number", 0) or 0),
        "poster_url": get_v("poster_url", "") or "",
        "custom_rating": custom_rating,
        "watched_with": str(get_v("watched_with", "") or ""),
        "viewing_venue": str(get_v("viewing_venue", "") or ""),
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
    custom_rating: int | None = None,
    watched_with: str = "",
    viewing_venue: str = "",
) -> dict:
    media_type = media_type or "movie"
    username = username or user_id

    with get_session() as session:
        user_cond = or_(
            Review.user_id == user_id,
            func.lower(Review.user_id) == user_id.lower(),
            func.lower(Review.username) == username.lower(),
        )
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
            custom_rating=custom_rating,
            watched_with=(watched_with or "").strip(),
            viewing_venue=(viewing_venue or "").strip(),
        )
        session.add(new_review)

        # Regra de negócio: Se o filme tem review, ele é automaticamente assistido
        user_w_cond = _user_condition(WatchedItem, user_id, username)
        existing_watched = session.scalar(
            select(WatchedItem).where(
                WatchedItem.tmdb_id == tmdb_id,
                WatchedItem.media_type == media_type,
                user_w_cond,
            )
        )
        if not existing_watched:
            session.add(
                _build_watched_item(
                    user_id=user_id,
                    username=username,
                    tmdb_id=tmdb_id,
                    media_type=media_type,
                    movie_title=movie_title,
                    poster_url=poster_url,
                    created_at=created_at,
                )
            )

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
        "custom_rating": custom_rating or 0,
        "watched_with": (watched_with or "").strip(),
        "viewing_venue": (viewing_venue or "").strip(),
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
    if not user_id and not username:
        return []

    with get_session() as session:
        rows = session.scalars(
            select(Review)
            .where(_user_condition(Review, user_id, username))
            .order_by(Review.created_at.desc())
        ).all()
        return [_format_review_row(r) for r in rows]


def delete_review(review_id: str, user_id: str = "", username: str = "") -> dict:
    if not review_id:
        return {"success": False, "message": "ID da avaliação não fornecido."}

    with get_session() as session:
        review = session.scalar(select(Review).where(Review.id == review_id))
        if not review:
            return {"success": False, "message": "Avaliação não encontrada."}

        rev_user_id = (review.user_id or "").strip()
        rev_username = (review.username or "").strip()

        is_owner = False
        if user_id and (rev_user_id == user_id or rev_user_id.lower() == user_id.lower()):
            is_owner = True
        elif username and (rev_username == username or rev_username.lower() == username.lower()):
            is_owner = True
        elif user_id and (rev_username == user_id or rev_username.lower() == user_id.lower()):
            is_owner = True

        if not is_owner:
            return {
                "success": False,
                "message": "Você só tem permissão para remover suas próprias avaliações.",
            }

        # Regra de negócio mandatória: Ao apagar uma crítica, a obra DEVE continuar como assistida!
        w_user_id = rev_user_id or user_id
        w_username = rev_username or username
        w_cond = _user_condition(WatchedItem, w_user_id, w_username)
        existing_watched = session.scalar(
            select(WatchedItem.id).where(
                WatchedItem.tmdb_id == review.tmdb_id,
                WatchedItem.media_type == (review.media_type or "movie"),
                w_cond,
            )
        )
        if not existing_watched:
            session.add(
                _build_watched_item(
                    user_id=w_user_id,
                    username=w_username,
                    tmdb_id=review.tmdb_id,
                    media_type=review.media_type or "movie",
                    movie_title=review.movie_title,
                    poster_url=review.poster_url,
                    created_at=review.created_at,
                )
            )

        session.delete(review)

    return {"success": True, "message": "Avaliação removida com sucesso."}


def toggle_watched(
    tmdb_id: int,
    user_id: str,
    username: str = "",
    media_type: str = "movie",
    movie_title: str = "",
    poster_url: str = "",
) -> dict:
    media_type = media_type or "movie"
    username = username or user_id

    with get_session() as session:
        user_cond = _user_condition(WatchedItem, user_id, username)
        watched_item = session.scalar(
            select(WatchedItem).where(
                WatchedItem.tmdb_id == tmdb_id,
                WatchedItem.media_type == media_type,
                user_cond,
            )
        )

        # Regra de negócio: Se o filme tem review, ele é automaticamente assistido
        rev_cond = _user_condition(Review, user_id, username)
        has_review = session.scalar(
            select(Review.id).where(
                Review.tmdb_id == tmdb_id,
                Review.media_type == media_type,
                rev_cond,
            )
        )

        if watched_item or has_review:
            # Usuário deseja desmarcar
            if has_review:
                return {
                    "success": False,
                    "message": "Este título possui uma avaliação registrada e não pode ser desmarcado dos assistidos sem antes excluir a avaliação.",
                    "active": True,
                }
            if watched_item:
                session.delete(watched_item)
            return {
                "success": True,
                "message": "Título removido dos assistidos.",
                "active": False,
            }

        # Não está assistido -> Adiciona
        session.add(
            _build_watched_item(
                user_id=user_id,
                username=username,
                tmdb_id=tmdb_id,
                media_type=media_type,
                movie_title=movie_title,
                poster_url=poster_url,
            )
        )
        return {
            "success": True,
            "message": "Título marcado como assistido.",
            "active": True,
        }


def toggle_favorite(
    tmdb_id: int,
    user_id: str,
    username: str = "",
    media_type: str = "movie",
    movie_title: str = "",
    poster_url: str = "",
) -> dict:
    media_type = media_type or "movie"
    username = username or user_id

    with get_session() as session:
        user_cond = _user_condition(FavoriteItem, user_id, username)
        fav_item = session.scalar(
            select(FavoriteItem).where(
                FavoriteItem.tmdb_id == tmdb_id,
                FavoriteItem.media_type == media_type,
                user_cond,
            )
        )

        if fav_item:
            session.delete(fav_item)
            return {
                "success": True,
                "message": "Título removido dos favoritos.",
                "active": False,
            }

        created_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        new_fav = FavoriteItem(
            id=str(uuid.uuid4()),
            user_id=user_id,
            username=username,
            tmdb_id=tmdb_id,
            media_type=media_type,
            movie_title=movie_title or "",
            poster_url=poster_url or "",
            created_at=created_at,
        )
        session.add(new_fav)
        return {
            "success": True,
            "message": "Título adicionado aos favoritos.",
            "active": True,
        }


def get_user_watched(user_id: str, username: str = "") -> list[dict]:
    with get_session() as session:
        # Busca avaliações do usuário para enriquecer e garantir regra de "tem review = assistido"
        rev_cond = _user_condition(Review, user_id, username)
        user_reviews = session.scalars(select(Review).where(rev_cond).order_by(Review.created_at.desc())).all()
        review_map: dict[tuple[int, str], Review] = {}
        for r in user_reviews:
            k = (int(r.tmdb_id), str(r.media_type or "movie"))
            if k not in review_map:
                review_map[k] = r

        # Busca registros explícitos de watched
        w_cond = _user_condition(WatchedItem, user_id, username)
        watched_rows = session.scalars(select(WatchedItem).where(w_cond).order_by(WatchedItem.created_at.desc())).all()

        combined: dict[tuple[int, str], dict] = {}
        for w in watched_rows:
            k = (int(w.tmdb_id), str(w.media_type or "movie"))
            combined[k] = _format_activity_item(w, review_map.get(k))

        # Constrói itens em memória para filmes avaliados que ainda não constavam na tabela watched (sem mutação no GET)
        for k, r in review_map.items():
            if k not in combined:
                w_item = _build_watched_item(
                    user_id=r.user_id,
                    username=r.username or r.user_id,
                    tmdb_id=int(r.tmdb_id),
                    media_type=r.media_type or "movie",
                    movie_title=r.movie_title,
                    poster_url=r.poster_url,
                    created_at=r.created_at,
                )
                combined[k] = _format_activity_item(w_item, r)

        items = list(combined.values())
        items.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return items


def get_user_favorites(user_id: str, username: str = "") -> list[dict]:
    with get_session() as session:
        # Busca avaliações do usuário para enriquecer com nota caso exista
        rev_cond = _user_condition(Review, user_id, username)
        user_reviews = session.scalars(select(Review).where(rev_cond)).all()
        review_map = {(int(r.tmdb_id), str(r.media_type or "movie")): r for r in user_reviews}

        fav_cond = _user_condition(FavoriteItem, user_id, username)
        fav_rows = session.scalars(select(FavoriteItem).where(fav_cond).order_by(FavoriteItem.created_at.desc())).all()

        return [
            _format_activity_item(f, review_map.get((int(f.tmdb_id), str(f.media_type or "movie"))))
            for f in fav_rows
        ]


def get_media_status(tmdb_id: int, user_id: str, username: str = "", media_type: str = "movie") -> dict:
    media_type = media_type or "movie"
    if not user_id and not username:
        return {
            "tmdb_id": tmdb_id,
            "media_type": media_type,
            "is_watched": False,
            "is_favorite": False,
            "has_review": False,
            "user_rating": 0.0,
            "review_id": "",
        }

    with get_session() as session:
        rev_cond = _user_condition(Review, user_id, username)
        rev = session.scalar(
            select(Review)
            .where(
                Review.tmdb_id == tmdb_id,
                Review.media_type == media_type,
                rev_cond,
            )
            .order_by(Review.created_at.desc())
        )

        w_cond = _user_condition(WatchedItem, user_id, username)
        watched_item = session.scalar(
            select(WatchedItem.id).where(
                WatchedItem.tmdb_id == tmdb_id,
                WatchedItem.media_type == media_type,
                w_cond,
            )
        )

        fav_cond = _user_condition(FavoriteItem, user_id, username)
        fav_item = session.scalar(
            select(FavoriteItem.id).where(
                FavoriteItem.tmdb_id == tmdb_id,
                FavoriteItem.media_type == media_type,
                fav_cond,
            )
        )

        return {
            "tmdb_id": tmdb_id,
            "media_type": media_type,
            "is_watched": bool(watched_item or rev),
            "is_favorite": bool(fav_item),
            "has_review": bool(rev),
            "user_rating": float(rev.rating) if rev else 0.0,
            "review_id": str(rev.id) if rev else "",
        }


