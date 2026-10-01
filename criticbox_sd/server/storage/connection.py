import contextlib
import os
import queue
import sqlite3
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
    custom_path = os.getenv("DATABASE_PATH")
    if custom_path:
        return custom_path

    # Raiz do projeto: data/criticbox.db
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    data_dir = os.path.join(base_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, "criticbox.db")


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
                    username VARCHAR(50) NOT NULL DEFAULT '',
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
                    INDEX idx_reviews_username (username),
                    INDEX idx_reviews_created_at (created_at DESC)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """)
            try:
                client.execute("ALTER TABLE reviews ADD COLUMN username VARCHAR(50) NOT NULL DEFAULT ''")
            except Exception:
                pass
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
                    username TEXT NOT NULL DEFAULT '',
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
                if "username" not in cols:
                    client.execute("ALTER TABLE reviews ADD COLUMN username TEXT NOT NULL DEFAULT ''")
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
            try:
                client.execute("CREATE INDEX IF NOT EXISTS idx_username ON reviews(username);")
            except Exception:
                pass


def clear_db():
    with get_connection() as client:
        client.execute("DELETE FROM reviews")
        client.execute("DELETE FROM users")
