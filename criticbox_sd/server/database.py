import contextlib
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

import pymysql
import pymysql.cursors


def is_mysql() -> bool:
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
        conn = sqlite3.connect(get_sqlite_path())
        conn.row_factory = sqlite3.Row
        try:
            with conn:
                yield DBClient(conn, is_mysql_conn=False)
        finally:
            conn.close()


def init_db():
    with get_connection() as client:
        if client.is_mysql:
            client.execute("""
                CREATE TABLE IF NOT EXISTS reviews (
                    id VARCHAR(36) NOT NULL,
                    tmdb_id INT NOT NULL,
                    user_id VARCHAR(50) NOT NULL,
                    rating DECIMAL(2, 1) NOT NULL,
                    comment TEXT NULL,
                    contains_spoilers TINYINT(1) NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    INDEX idx_reviews_tmdb_id (tmdb_id),
                    INDEX idx_reviews_user_id (user_id),
                    INDEX idx_reviews_created_at (created_at DESC)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """)
        else:
            client.execute("""
                CREATE TABLE IF NOT EXISTS reviews (
                    id TEXT PRIMARY KEY,
                    tmdb_id INTEGER NOT NULL,
                    user_id TEXT NOT NULL,
                    rating REAL NOT NULL,
                    comment TEXT,
                    contains_spoilers INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );
            """)
            client.execute("CREATE INDEX IF NOT EXISTS idx_tmdb_id ON reviews(tmdb_id);")


def clear_db():
    with get_connection() as client:
        client.execute("DELETE FROM reviews")


def add_review(tmdb_id: int, user_id: str, rating: float, comment: str, contains_spoilers: bool) -> dict:
    review_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    with get_connection() as client:
        client.execute(
            "INSERT INTO reviews (id, tmdb_id, user_id, rating, comment, contains_spoilers, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (review_id, tmdb_id, user_id, rating, comment, int(contains_spoilers), created_at),
        )
    return {
        "review_id": review_id,
        "tmdb_id": tmdb_id,
        "user_id": user_id,
        "rating": rating,
        "comment": comment,
        "contains_spoilers": contains_spoilers,
        "created_at": created_at,
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


def get_all_reviews() -> list:
    with get_connection() as client:
        rows = client.execute("SELECT * FROM reviews ORDER BY created_at DESC").fetchall()
        return [
            {
                "review_id": r["id"],
                "tmdb_id": r["tmdb_id"],
                "user_id": r["user_id"],
                "rating": float(r["rating"]),
                "comment": r["comment"] or "",
                "contains_spoilers": bool(r["contains_spoilers"]),
                "created_at": str(r["created_at"]),
                "success": True,
                "message": "",
            }
            for r in rows
        ]
