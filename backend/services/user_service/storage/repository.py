import hashlib
import hmac
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, or_, select

from services.user_service.storage.connection import get_session
from services.user_service.storage.models import Follow, User



def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    kdf = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"{salt.hex()}:{kdf.hex()}"


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        salt_hex, kdf_hex = password_hash.split(":")
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(kdf_hex)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def create_user(username: str, password: str) -> dict:
    username = username.strip()
    if not username:
        return {"success": False, "message": "Nome de usuário não pode estar em branco.", "user_id": "", "username": ""}
    if len(password) < 6:
        return {"success": False, "message": "A senha deve ter no mínimo 6 caracteres.", "user_id": "", "username": ""}

    with get_session() as session:
        existing = session.scalar(select(User).where(func.lower(User.username) == username.lower()))
        if existing:
            return {
                "success": False,
                "message": f"Usuário '{username}' já existe.",
                "user_id": "",
                "username": username,
            }

        user_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        password_hash = _hash_password(password)

        new_user = User(
            id=user_id,
            username=username,
            password_hash=password_hash,
            created_at=created_at,
        )
        session.add(new_user)

    return {
        "success": True,
        "message": "Usuário registrado com sucesso!",
        "user_id": user_id,
        "username": username,
    }


def authenticate_user(username: str, password: str) -> dict:
    username = username.strip()
    with get_session() as session:
        user = session.scalar(select(User).where(func.lower(User.username) == username.lower()))
        if not user:
            return {"success": False, "message": "Usuário não encontrado.", "user_id": "", "username": ""}
        if not _verify_password(password, user.password_hash):
            return {"success": False, "message": "Senha incorreta.", "user_id": "", "username": ""}
        return {
            "success": True,
            "message": "Autenticação realizada com sucesso!",
            "user_id": user.id,
            "username": user.username,
        }


def _resolve_user(session, user_id_or_username: str) -> User | None:
    val = (user_id_or_username or "").strip()
    if not val:
        return None
    val_clean = val.lstrip("@").strip()
    return session.scalar(
        select(User).where(
            or_(
                User.id == val,
                User.id == val_clean,
                func.lower(User.username) == val.lower(),
                func.lower(User.username) == val_clean.lower(),
            )
        )
    )


def search_users(query: str, limit: int = 10) -> list[dict]:
    q = (query or "").strip().lower()
    if not q:
        return []
    limit = max(1, min(limit or 10, 50))
    with get_session() as session:
        stmt = (
            select(User)
            .where(func.lower(User.username).like(f"%{q}%"))
            .order_by(User.username.asc())
            .limit(limit)
        )
        users = session.scalars(stmt).all()
        return [
            {
                "user_id": u.id,
                "username": u.username,
                "created_at": u.created_at,
                "avatar_url": getattr(u, "avatar_url", "") or "",
            }
            for u in users
        ]


def follow_user(follower_id_or_name: str, following_id_or_name: str) -> dict:
    with get_session() as session:
        follower = _resolve_user(session, follower_id_or_name)
        following = _resolve_user(session, following_id_or_name)

        if not follower:
            return {"success": False, "message": "Usuário seguidor não encontrado.", "is_mutual": False}
        if not following:
            return {"success": False, "message": "Usuário a seguir não encontrado.", "is_mutual": False}
        if follower.id == following.id:
            return {"success": False, "message": "Você não pode seguir a si mesmo.", "is_mutual": False}

        # Verifica se já segue
        existing = session.scalar(
            select(Follow).where(
                Follow.follower_id == follower.id,
                Follow.following_id == following.id,
            )
        )
        if not existing:
            now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            follow_record = Follow(
                id=str(uuid.uuid4()),
                follower_id=follower.id,
                following_id=following.id,
                created_at=now_str,
            )
            session.add(follow_record)
            session.flush()

        # Verifica mutualidade (amigos)
        mutual_rec = session.scalar(
            select(Follow.id).where(
                Follow.follower_id == following.id,
                Follow.following_id == follower.id,
            )
        )
        is_mutual = mutual_rec is not None

        return {
            "success": True,
            "message": f"Você agora está seguindo @{following.username}!",
            "is_mutual": is_mutual,
        }


def unfollow_user(follower_id_or_name: str, following_id_or_name: str) -> dict:
    with get_session() as session:
        follower = _resolve_user(session, follower_id_or_name)
        following = _resolve_user(session, following_id_or_name)

        if not follower or not following:
            return {"success": False, "message": "Usuário não encontrado."}

        session.execute(
            delete(Follow).where(
                Follow.follower_id == follower.id,
                Follow.following_id == following.id,
            )
        )
        return {
            "success": True,
            "message": f"Você deixou de seguir @{following.username}.",
        }


def get_user_profile(username_or_id: str, current_user_id_or_name: str = "") -> dict:
    with get_session() as session:
        target = _resolve_user(session, username_or_id)
        if not target:
            return {
                "success": False,
                "message": f"Usuário '{username_or_id}' não encontrado.",
                "user_id": "",
                "username": "",
                "created_at": "",
                "followers_count": 0,
                "following_count": 0,
                "is_following": False,
                "is_followed_by": False,
                "is_mutual": False,
            }

        followers_count = (
            session.scalar(
                select(func.count(Follow.id)).where(Follow.following_id == target.id)
            )
            or 0
        )
        following_count = (
            session.scalar(
                select(func.count(Follow.id)).where(Follow.follower_id == target.id)
            )
            or 0
        )

        is_following = False
        is_followed_by = False
        is_mutual = False

        if current_user_id_or_name:
            curr = _resolve_user(session, current_user_id_or_name)
            if curr and curr.id != target.id:
                is_following = (
                    session.scalar(
                        select(Follow.id).where(
                            Follow.follower_id == curr.id,
                            Follow.following_id == target.id,
                        )
                    )
                    is not None
                )
                is_followed_by = (
                    session.scalar(
                        select(Follow.id).where(
                            Follow.follower_id == target.id,
                            Follow.following_id == curr.id,
                        )
                    )
                    is not None
                )
                is_mutual = is_following and is_followed_by

        return {
            "success": True,
            "message": "",
            "user_id": target.id,
            "username": target.username,
            "created_at": target.created_at,
            "avatar_url": getattr(target, "avatar_url", "") or "",
            "four_pillars": getattr(target, "four_pillars", "") or "",
            "followers_count": int(followers_count),
            "following_count": int(following_count),
            "is_following": is_following,
            "is_followed_by": is_followed_by,
            "is_mutual": is_mutual,
        }


def update_user_profile(user_id_or_username: str, avatar_url: str | None = None, four_pillars: str | None = None) -> dict:
    with get_session() as session:
        user = _resolve_user(session, user_id_or_username)
        if not user:
            return {"success": False, "message": "Usuário não encontrado."}
        if avatar_url is not None:
            user.avatar_url = avatar_url.strip()
        if four_pillars is not None:
            user.four_pillars = four_pillars.strip()
        session.flush()
        return {
            "success": True,
            "message": "Perfil atualizado com sucesso!",
            "avatar_url": getattr(user, "avatar_url", "") or "",
            "four_pillars": getattr(user, "four_pillars", "") or "",
        }


def get_user_followers(user_id_or_username: str) -> list[dict]:
    with get_session() as session:
        target = _resolve_user(session, user_id_or_username)
        if not target:
            return []

        stmt = (
            select(User)
            .join(Follow, Follow.follower_id == User.id)
            .where(Follow.following_id == target.id)
            .order_by(Follow.created_at.desc())
        )
        users = session.scalars(stmt).all()
        return [
            {
                "user_id": u.id,
                "username": u.username,
                "created_at": u.created_at,
                "avatar_url": getattr(u, "avatar_url", "") or "",
            }
            for u in users
        ]


def get_user_following(user_id_or_username: str) -> list[dict]:
    with get_session() as session:
        target = _resolve_user(session, user_id_or_username)
        if not target:
            return []

        stmt = (
            select(User)
            .join(Follow, Follow.following_id == User.id)
            .where(Follow.follower_id == target.id)
            .order_by(Follow.created_at.desc())
        )
        users = session.scalars(stmt).all()
        return [
            {
                "user_id": u.id,
                "username": u.username,
                "created_at": u.created_at,
                "avatar_url": getattr(u, "avatar_url", "") or "",
            }
            for u in users
        ]

