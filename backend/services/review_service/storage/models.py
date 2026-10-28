from sqlalchemy import Boolean, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class ReviewBase(DeclarativeBase):
    pass


class Review(ReviewBase):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(50), index=True, default="", nullable=False)
    rating: Mapped[float] = mapped_column(Float, nullable=False)
    comment: Mapped[str] = mapped_column(Text, default="", nullable=False)
    contains_spoilers: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    media_type: Mapped[str] = mapped_column(String(20), default="movie", nullable=False)
    season_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    episode_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    movie_title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    poster_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    custom_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    watched_with: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    viewing_venue: Mapped[str] = mapped_column(String(100), default="", nullable=False)



class WatchedItem(ReviewBase):
    __tablename__ = "watched"
    __table_args__ = (
        UniqueConstraint("user_id", "tmdb_id", "media_type", name="uq_user_watched_media"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(50), index=True, default="", nullable=False)
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    media_type: Mapped[str] = mapped_column(String(20), default="movie", nullable=False)
    movie_title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    poster_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    created_at: Mapped[str] = mapped_column(String(30), index=True, nullable=False)


class FavoriteItem(ReviewBase):
    __tablename__ = "favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "tmdb_id", "media_type", name="uq_user_favorite_media"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(50), index=True, default="", nullable=False)
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    media_type: Mapped[str] = mapped_column(String(20), default="movie", nullable=False)
    movie_title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    poster_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    created_at: Mapped[str] = mapped_column(String(30), index=True, nullable=False)

