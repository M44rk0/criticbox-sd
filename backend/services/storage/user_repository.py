import hashlib
import hmac
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from services.storage.connection import get_session
from services.storage.models import User


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
        existing = session.scalar(select(User).where(User.username == username))
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
        user = session.scalar(select(User).where(User.username == username))
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
