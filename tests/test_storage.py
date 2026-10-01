import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


from criticbox_sd.services.storage import (
    _verify_password,
    add_review,
    authenticate_user,
    clear_db,
    create_user,
    get_all_reviews,
    get_batch_movie_stats,
    get_connection,
    get_movie_stats,
    get_reviews_by_movie,
    get_reviews_by_user,
    init_db,
    update_review_poster,
)


class TestStorageLayer(unittest.TestCase):
    def setUp(self):
        init_db()
        clear_db()

    def tearDown(self):
        clear_db()

    def test_create_user_success(self):
        res = create_user("alice", "securepass123")
        self.assertTrue(res["success"])
        self.assertEqual(res["username"], "alice")
        self.assertTrue(len(res["user_id"]) > 0)

    def test_create_user_blank_username_fails(self):
        res = create_user("   ", "securepass123")
        self.assertFalse(res["success"])
        self.assertIn("em branco", res["message"])

    def test_create_user_short_password_fails(self):
        res = create_user("bob", "123")
        self.assertFalse(res["success"])
        self.assertIn("mínimo 6 caracteres", res["message"])

    def test_create_user_duplicate_fails(self):
        create_user("carlos", "password123")
        res = create_user("carlos", "password456")
        self.assertFalse(res["success"])
        self.assertIn("já existe", res["message"])

    def test_authenticate_user_success(self):
        create_user("daniela", "mypassword")
        res = authenticate_user("daniela", "mypassword")
        self.assertTrue(res["success"])
        self.assertEqual(res["username"], "daniela")

    def test_authenticate_user_wrong_password(self):
        create_user("eduardo", "mypassword")
        res = authenticate_user("eduardo", "wrongpass")
        self.assertFalse(res["success"])
        self.assertIn("Senha incorreta", res["message"])

    def test_authenticate_user_not_found(self):
        res = authenticate_user("nonexistent", "anypassword")
        self.assertFalse(res["success"])
        self.assertIn("não encontrado", res["message"])

    def test_verify_password_malformed_hash(self):
        self.assertFalse(_verify_password("pass", "malformed_hash_without_colon"))
        self.assertFalse(_verify_password("pass", "nothex:nothex"))

    def test_add_and_get_reviews_movie(self):
        res = add_review(
            tmdb_id=100,
            user_id="user_a",
            rating=4.5,
            comment="Ótimo filme!",
            contains_spoilers=False,
            media_type="movie",
            movie_title="Filme Teste",
            poster_url="https://example.com/p.jpg",
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["tmdb_id"], 100)

        movie_revs = get_reviews_by_movie(100)
        self.assertEqual(len(movie_revs), 1)
        self.assertEqual(movie_revs[0]["movie_title"], "Filme Teste")

        user_revs = get_reviews_by_user("user_a")
        self.assertEqual(len(user_revs), 1)
        self.assertEqual(user_revs[0]["rating"], 4.5)

    def test_add_review_movie_duplicate_blocked(self):
        add_review(tmdb_id=101, user_id="user_dup", rating=4.0)
        res = add_review(tmdb_id=101, user_id="user_dup", rating=5.0)
        self.assertFalse(res["success"])
        self.assertIn("já avaliou este filme", res["message"])

    def test_add_review_series_season_and_episode_duplicates(self):
        res1 = add_review(
            tmdb_id=200,
            user_id="user_tv",
            rating=4.0,
            media_type="tv",
            season_number=1,
            episode_number=None,
        )
        self.assertTrue(res1["success"])

        res2 = add_review(
            tmdb_id=200,
            user_id="user_tv",
            rating=4.5,
            media_type="tv",
            season_number=1,
            episode_number=None,
        )
        self.assertFalse(res2["success"])
        self.assertIn("Temporada 1", res2["message"])

        res3 = add_review(
            tmdb_id=200,
            user_id="user_tv",
            rating=5.0,
            media_type="tv",
            season_number=1,
            episode_number=2,
        )
        self.assertTrue(res3["success"])

        res4 = add_review(
            tmdb_id=200,
            user_id="user_tv",
            rating=3.0,
            media_type="tv",
            season_number=1,
            episode_number=2,
        )
        self.assertFalse(res4["success"])
        self.assertIn("Episódio 2", res4["message"])

        res5 = add_review(tmdb_id=201, user_id="user_tv2", rating=4.0, media_type="tv")
        self.assertTrue(res5["success"])
        res6 = add_review(tmdb_id=201, user_id="user_tv2", rating=3.5, media_type="tv")
        self.assertFalse(res6["success"])
        self.assertIn("série completa", res6["message"])

    def test_movie_stats_single_and_batch(self):
        empty_stats = get_movie_stats(999)
        self.assertEqual(empty_stats["average_rating"], 0.0)
        self.assertEqual(empty_stats["total_count"], 0)

        add_review(tmdb_id=300, user_id="u1", rating=4.0)
        add_review(tmdb_id=300, user_id="u2", rating=5.0)
        add_review(tmdb_id=301, user_id="u3", rating=3.0)

        stats_300 = get_movie_stats(300)
        self.assertEqual(stats_300["average_rating"], 4.5)
        self.assertEqual(stats_300["total_count"], 2)

        batch = get_batch_movie_stats([300, 301, 302])
        self.assertEqual(batch[300]["total_count"], 2)
        self.assertEqual(batch[300]["average_rating"], 4.5)
        self.assertEqual(batch[301]["total_count"], 1)
        self.assertEqual(batch[301]["average_rating"], 3.0)
        self.assertEqual(batch[302]["total_count"], 0)
        self.assertEqual(batch[302]["average_rating"], 0.0)

        self.assertEqual(get_batch_movie_stats([]), {})

    def test_update_review_poster(self):
        res = add_review(tmdb_id=400, user_id="u_poster", rating=4.0, poster_url="")
        rev_id = res["review_id"]
        update_review_poster(rev_id, "https://example.com/new_poster.jpg")

        revs = get_all_reviews(limit=10)
        self.assertEqual(revs[0]["poster_url"], "https://example.com/new_poster.jpg")

        update_review_poster("", "https://example.com/other.jpg")
        update_review_poster(rev_id, "")

    def test_format_review_row_dict_and_model(self):
        from criticbox_sd.services.storage.models import Review
        from criticbox_sd.services.storage.review_repository import _format_review_row

        row_dict = {
            "id": "rev1",
            "tmdb_id": 550,
            "user_id": "u1",
            "username": "user1",
            "rating": 4.5,
            "comment": "Nice",
            "contains_spoilers": False,
            "created_at": "2026-10-01 12:00:00",
            "media_type": "movie",
            "season_number": 0,
            "episode_number": 0,
            "movie_title": "Fight Club",
            "poster_url": "https://img.jpg",
        }
        res_dict = _format_review_row(row_dict)
        self.assertEqual(res_dict["review_id"], "rev1")
        self.assertEqual(res_dict["username"], "user1")

        model_rev = Review(
            id="rev2",
            tmdb_id=680,
            user_id="u2",
            username="user2",
            rating=5.0,
            comment="Awesome",
            contains_spoilers=True,
            created_at="2026-10-01 12:00:00",
            media_type="movie",
            season_number=0,
            episode_number=0,
            movie_title="Pulp Fiction",
            poster_url="https://img2.jpg",
        )
        res_model = _format_review_row(model_rev)
        self.assertEqual(res_model["review_id"], "rev2")
        self.assertEqual(res_model["username"], "user2")

    def test_database_connection_context_manager(self):
        with get_connection() as conn:
            conn.execute("SELECT 1")

    def test_is_mysql_detection(self):
        from criticbox_sd.services.storage.connection import is_mysql

        self.assertFalse(is_mysql())

        old_dp = os.environ.get("DATABASE_PATH")
        old_host = os.environ.get("DB_HOST")
        old_type = os.environ.get("DB_TYPE")
        try:
            os.environ.pop("DATABASE_PATH", None)
            os.environ["DB_HOST"] = "10.0.0.1"
            self.assertTrue(is_mysql())

            os.environ.pop("DB_HOST", None)
            os.environ["DB_TYPE"] = "mysql"
            self.assertTrue(is_mysql())

            os.environ["DB_TYPE"] = "sqlite"
            self.assertFalse(is_mysql())
        finally:
            if old_dp is not None:
                os.environ["DATABASE_PATH"] = old_dp
            else:
                os.environ.pop("DATABASE_PATH", None)
            if old_host is not None:
                os.environ["DB_HOST"] = old_host
            else:
                os.environ.pop("DB_HOST", None)
            if old_type is not None:
                os.environ["DB_TYPE"] = old_type
            else:
                os.environ.pop("DB_TYPE", None)

    def test_get_sqlite_path(self):
        from criticbox_sd.services.storage.connection import get_sqlite_path

        old_dp = os.environ.get("DATABASE_PATH")
        try:
            os.environ["DATABASE_PATH"] = "/custom/path/db.sqlite"
            self.assertEqual(get_sqlite_path(), "/custom/path/db.sqlite")

            os.environ.pop("DATABASE_PATH", None)
            default_path = get_sqlite_path()
            self.assertTrue(default_path.endswith("criticbox.db"))
        finally:
            if old_dp is not None:
                os.environ["DATABASE_PATH"] = old_dp

    def test_dbclient_mysql_adaptation(self):
        from unittest.mock import MagicMock

        from criticbox_sd.services.storage.connection import DBClient

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        client = DBClient(conn=mock_conn, is_mysql_conn=True)
        client.execute("SELECT * FROM users WHERE id = ? AND username = ?", ("u1", "alice"))

        mock_cursor.execute.assert_called_once_with(
            "SELECT * FROM users WHERE id = %s AND username = %s",
            ("u1", "alice"),
        )

    def test_get_connection_mysql_lifecycle(self):
        from unittest.mock import MagicMock, patch

        from criticbox_sd.services.storage.connection import get_connection

        mock_conn = MagicMock()
        with patch("criticbox_sd.services.storage.connection.is_mysql", return_value=True):
            with patch("pymysql.connect", return_value=mock_conn):
                with get_connection() as client:
                    self.assertTrue(client.is_mysql)
                    self.assertEqual(client.conn, mock_conn)
                mock_conn.close.assert_called_once()

    def test_get_connection_exception_rolls_back_and_raises(self):
        from criticbox_sd.services.storage.connection import get_connection

        with self.assertRaises(RuntimeError):
            with get_connection():
                raise RuntimeError("Falha proposital de banco")

    def test_sqlite_pool_queue_full_cleanup(self):
        import queue

        from criticbox_sd.services.storage.connection import _SQLITE_POOL, get_connection

        dummy_conns = []
        try:
            while not _SQLITE_POOL.full():
                dummy_conns.append(object())
                _SQLITE_POOL.put_nowait(dummy_conns[-1])

            with get_connection() as client:
                self.assertIsNotNone(client)
        finally:
            while not _SQLITE_POOL.empty():
                try:
                    _SQLITE_POOL.get_nowait()
                except queue.Empty:
                    break

    def test_init_db_and_clear_db(self):
        init_db()
        create_user("test_user_orm", "password123")
        clear_db()
        user_res = authenticate_user("test_user_orm", "password123")
        self.assertFalse(user_res["success"])

    def test_get_database_url_and_engine(self):
        from unittest.mock import patch

        from criticbox_sd.services.storage.connection import get_database_url, get_engine

        sqlite_url = get_database_url()
        self.assertTrue(sqlite_url.startswith("sqlite:///"))

        with patch("criticbox_sd.services.storage.connection.is_mysql", return_value=True):
            mysql_url = get_database_url()
            self.assertTrue(mysql_url.startswith("mysql+pymysql://"))

        engine = get_engine()
        self.assertIsNotNone(engine)


if __name__ == "__main__":
    unittest.main()
