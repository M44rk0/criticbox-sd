import contextlib
import hashlib
import hmac
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

import pymysql
import pymysql.cursors
from dotenv import load_dotenv

load_dotenv()


def is_mysql() -> bool:
    if os.getenv("DATABASE_PATH"):
        return False
    return bool(os.getenv("DB_HOST")) or os.getenv("DB_TYPE", "").lower() == "mysql"


def get_sqlite_path() -> str:
    return os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "criticbox.db"))


class DBClient:
    def __init__(self, conn: Any, is_mysql_conn: bool):
        self.conn = conn
        self.is_mysql = is_mysql_conn

    def execute(self, query: str, params: tuple = ()) -> Any:
        ph = "%s" if self.is_mysql else "?"
        adapted_query = query.replace("?", ph)
        if self.is_mysql:
            cursor = self.conn.cursor()
            cursor.execute(adapted_query, params)
            return cursor
        return self.conn.execute(adapted_query, params)


import queue

_SQLITE_POOL: queue.Queue = queue.Queue(maxsize=20)


def _create_sqlite_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(get_sqlite_path(), timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn


@contextlib.contextmanager
def get_connection():
    if is_mysql():
        conn = pymysql.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "3306")),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "criticbox"),
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,
        )
        try:
            yield DBClient(conn, is_mysql_conn=True)
        finally:
            conn.close()
    else:
        conn = None
        try:
            conn = _SQLITE_POOL.get_nowait()
        except queue.Empty:
            conn = _create_sqlite_conn()

        try:
            with conn:
                yield DBClient(conn, is_mysql_conn=False)
            try:
                _SQLITE_POOL.put_nowait(conn)
            except queue.Full:
                conn.close()
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
            raise


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


def init_db():
    with get_connection() as client:
        if client.is_mysql:
            client.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(36) NOT NULL,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    INDEX idx_users_username (username)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """)
            client.execute("""
                CREATE TABLE IF NOT EXISTS reviews (
                    id VARCHAR(36) NOT NULL,
                    tmdb_id INT NOT NULL,
                    user_id VARCHAR(50) NOT NULL,
                    rating DECIMAL(2, 1) NOT NULL,
                    comment TEXT NULL,
                    contains_spoilers TINYINT(1) NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    media_type VARCHAR(20) NOT NULL DEFAULT 'movie',
                    season_number INT NULL,
                    episode_number INT NULL,
                    movie_title VARCHAR(255) NOT NULL DEFAULT '',
                    poster_url VARCHAR(500) NOT NULL DEFAULT '',
                    PRIMARY KEY (id),
                    INDEX idx_reviews_tmdb_id (tmdb_id),
                    INDEX idx_reviews_user_id (user_id),
                    INDEX idx_reviews_created_at (created_at DESC)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """)
            try:
                client.execute("ALTER TABLE reviews ADD COLUMN media_type VARCHAR(20) NOT NULL DEFAULT 'movie'")
            except Exception:
                pass
            try:
                client.execute("ALTER TABLE reviews ADD COLUMN season_number INT NULL")
            except Exception:
                pass
            try:
                client.execute("ALTER TABLE reviews ADD COLUMN episode_number INT NULL")
            except Exception:
                pass
            try:
                client.execute("ALTER TABLE reviews ADD COLUMN movie_title VARCHAR(255) NOT NULL DEFAULT ''")
            except Exception:
                pass
            try:
                client.execute("ALTER TABLE reviews ADD COLUMN poster_url VARCHAR(500) NOT NULL DEFAULT ''")
            except Exception:
                pass
        else:
            client.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
            """)
            client.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);")
            client.execute("""
                CREATE TABLE IF NOT EXISTS reviews (
                    id TEXT PRIMARY KEY,
                    tmdb_id INTEGER NOT NULL,
                    user_id TEXT NOT NULL,
                    rating REAL NOT NULL,
                    comment TEXT,
                    contains_spoilers INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    media_type TEXT NOT NULL DEFAULT 'movie',
                    season_number INTEGER,
                    episode_number INTEGER,
                    movie_title TEXT NOT NULL DEFAULT '',
                    poster_url TEXT NOT NULL DEFAULT ''
                );
            """)
            client.execute("CREATE INDEX IF NOT EXISTS idx_tmdb_id ON reviews(tmdb_id);")
            client.execute("CREATE INDEX IF NOT EXISTS idx_user_id ON reviews(user_id);")
            try:
                cursor = client.execute("PRAGMA table_info(reviews)")
                cols = [dict(c)["name"] if hasattr(c, "keys") else c[1] for c in cursor.fetchall()]
                if "media_type" not in cols:
                    client.execute("ALTER TABLE reviews ADD COLUMN media_type TEXT NOT NULL DEFAULT 'movie'")
                if "season_number" not in cols:
                    client.execute("ALTER TABLE reviews ADD COLUMN season_number INTEGER")
                if "episode_number" not in cols:
                    client.execute("ALTER TABLE reviews ADD COLUMN episode_number INTEGER")
                if "movie_title" not in cols:
                    client.execute("ALTER TABLE reviews ADD COLUMN movie_title TEXT NOT NULL DEFAULT ''")
                if "poster_url" not in cols:
                    client.execute("ALTER TABLE reviews ADD COLUMN poster_url TEXT NOT NULL DEFAULT ''")
            except Exception:
                pass


def update_review_poster(review_id: str, poster_url: str):
    if not review_id or not poster_url:
        return
    with get_connection() as client:
        client.execute("UPDATE reviews SET poster_url = ? WHERE id = ? AND (poster_url = '' OR poster_url IS NULL)", (poster_url, review_id))


def clear_db():
    with get_connection() as client:
        client.execute("DELETE FROM reviews")
        client.execute("DELETE FROM users")


def create_user(username: str, password: str) -> dict:
    username = username.strip()
    if not username:
        return {"success": False, "message": "Nome de usuário não pode estar em branco.", "user_id": "", "username": ""}
    if len(password) < 6:
        return {"success": False, "message": "A senha deve ter no mínimo 6 caracteres.", "user_id": "", "username": ""}

    with get_connection() as client:
        existing = client.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            return {"success": False, "message": f"Usuário '{username}' já existe.", "user_id": "", "username": username}

        user_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        password_hash = _hash_password(password)

        client.execute(
            "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (user_id, username, password_hash, created_at),
        )
    return {
        "success": True,
        "message": "Usuário registrado com sucesso!",
        "user_id": user_id,
        "username": username,
    }


def authenticate_user(username: str, password: str) -> dict:
    username = username.strip()
    with get_connection() as client:
        row = client.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if not row:
            return {"success": False, "message": "Usuário não encontrado.", "user_id": "", "username": ""}
        if not _verify_password(password, row["password_hash"]):
            return {"success": False, "message": "Senha incorreta.", "user_id": "", "username": ""}
        return {
            "success": True,
            "message": "Autenticação realizada com sucesso!",
            "user_id": row["id"],
            "username": row["username"],
        }


def get_user_by_id(user_id: str) -> dict | None:
    with get_connection() as client:
        row = client.execute("SELECT id, username, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return None
        return {"user_id": row["id"], "username": row["username"], "created_at": str(row["created_at"])}


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
        # Validação unificada de duplicidade com COALESCE
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
            (review_id, tmdb_id, user_id, rating, comment, int(contains_spoilers), created_at, media_type, season_number, episode_number, movie_title or "", poster_url or ""),
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

