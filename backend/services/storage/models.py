from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[str] = mapped_column(String(30), nullable=False)


class Review(Base):
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
