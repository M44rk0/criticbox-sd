import contextlib
import os
import queue
import sqlite3
from collections.abc import Generator
from typing import Any

import pymysql
import pymysql.cursors
from dotenv import load_dotenv
from sqlalchemy import Engine, create_engine, delete, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from services.review_service.storage.models import Review, ReviewBase

load_dotenv()


def is_mysql() -> bool:
    if os.getenv("REVIEW_DATABASE_PATH") or os.getenv("DATABASE_PATH"):
        return False
    return bool(os.getenv("REVIEW_DB_HOST") or os.getenv("DB_HOST")) or os.getenv("DB_TYPE", "").lower() == "mysql"


def get_sqlite_path() -> str:
    custom_path = os.getenv("REVIEW_DATABASE_PATH") or os.getenv("DATABASE_PATH")
    if custom_path:
        return custom_path

    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    data_dir = os.path.join(backend_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, "reviews.db")


def get_database_url() -> str:
    if is_mysql():
        host = os.getenv("REVIEW_DB_HOST") or os.getenv("DB_HOST", "localhost")
        port = os.getenv("REVIEW_DB_PORT") or os.getenv("DB_PORT", "3306")
        user = os.getenv("REVIEW_DB_USER") or os.getenv("DB_USER", "root")
        password = os.getenv("REVIEW_DB_PASSWORD") or os.getenv("DB_PASSWORD", "")
        database = os.getenv("REVIEW_DB_NAME") or os.getenv("DB_NAME_REVIEW") or "criticbox_reviews"
        return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}?charset=utf8mb4"

    sqlite_path = get_sqlite_path().replace("\\", "/")
    return f"sqlite:///{sqlite_path}"


_ENGINES: dict[str, Engine] = {}


def get_engine() -> Engine:
    url = get_database_url()
    if url not in _ENGINES:
        if url.startswith("sqlite"):
            engine = create_engine(
                url,
                connect_args={"check_same_thread": False},
                poolclass=StaticPool if ":memory:" in url else None,
            )

            @event.listens_for(engine, "connect")
            def set_sqlite_pragma(dbapi_connection, connection_record):
                if isinstance(dbapi_connection, sqlite3.Connection):
                    cursor = dbapi_connection.cursor()
                    cursor.execute("PRAGMA journal_mode = WAL")
                    cursor.execute("PRAGMA synchronous = NORMAL")
                    cursor.execute("PRAGMA busy_timeout = 5000")
                    cursor.close()
        else:
            engine = create_engine(
                url,
                pool_pre_ping=True,
                pool_recycle=3600,
            )
        _ENGINES[url] = engine
    return _ENGINES[url]


def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(autocommit=False, autoflush=False, bind=get_engine())


@contextlib.contextmanager
def get_session() -> Generator[Session, None, None]:
    sm = get_sessionmaker()
    session = sm()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db():
    engine = get_engine()
    ReviewBase.metadata.create_all(bind=engine)


def clear_db():
    with get_session() as session:
        session.execute(delete(Review))


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
            host=os.getenv("REVIEW_DB_HOST") or os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("REVIEW_DB_PORT") or os.getenv("DB_PORT", "3306")),
            user=os.getenv("REVIEW_DB_USER") or os.getenv("DB_USER", "root"),
            password=os.getenv("REVIEW_DB_PASSWORD") or os.getenv("DB_PASSWORD", ""),
            database=os.getenv("REVIEW_DB_NAME") or os.getenv("DB_NAME_REVIEW") or "criticbox_reviews",
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

        cm = conn if hasattr(conn, "__enter__") else contextlib.nullcontext(conn)
        try:
            with cm:
                yield DBClient(conn, is_mysql_conn=False)
            try:
                _SQLITE_POOL.put_nowait(conn)
            except queue.Full:
                if hasattr(conn, "close"):
                    conn.close()
        except Exception:
            try:
                if hasattr(conn, "close"):
                    conn.close()
            except Exception:
                pass
            raise
