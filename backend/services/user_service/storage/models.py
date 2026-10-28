from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class UserBase(DeclarativeBase):
    pass


class User(UserBase):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[str] = mapped_column(String(30), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    four_pillars: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)


class Follow(UserBase):
    __tablename__ = "follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="uq_user_follows"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    follower_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    following_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    created_at: Mapped[str] = mapped_column(String(30), nullable=False)

