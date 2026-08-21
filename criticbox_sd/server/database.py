import os
import sqlite3
import uuid
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "criticbox.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS reviews (
                id TEXT PRIMARY KEY,
                tmdb_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                rating REAL NOT NULL,
                comment TEXT,
                contains_spoilers INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tmdb_id ON reviews(tmdb_id);
        """)


def add_review(tmdb_id: int, user_id: str, rating: float, comment: str, contains_spoilers: bool) -> dict:
    review_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    with get_connection() as conn:
        conn.execute(
            "INSERT INTO reviews VALUES (?, ?, ?, ?, ?, ?, ?)",
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


def get_reviews_by_movie(tmdb_id: int) -> list:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM reviews WHERE tmdb_id = ? ORDER BY created_at DESC", (tmdb_id,)).fetchall()
        return [
            {
                "review_id": r["id"],
                "tmdb_id": r["tmdb_id"],
                "user_id": r["user_id"],
                "rating": r["rating"],
                "comment": r["comment"] or "",
                "contains_spoilers": bool(r["contains_spoilers"]),
                "created_at": r["created_at"],
                "success": True,
                "message": "",
            }
            for r in rows
        ]


def get_movie_stats(tmdb_id: int) -> dict:
    with get_connection() as conn:
        row = conn.execute("SELECT AVG(rating), COUNT(id) FROM reviews WHERE tmdb_id = ?", (tmdb_id,)).fetchone()
        avg_rating, count = row[0] or 0.0, row[1] or 0
        return {"average_rating": round(float(avg_rating), 1), "total_count": int(count)}
