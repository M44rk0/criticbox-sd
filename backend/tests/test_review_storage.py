import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from sqlalchemy import inspect

from services.review_service.storage import (
    Review,
    _format_review_row,
    add_review,
    clear_db,
    get_all_reviews,
    get_batch_movie_stats,
    get_connection,
    get_database_url,
    get_engine,
    get_movie_stats,
    get_reviews_by_movie,
    get_reviews_by_user,
    get_sqlite_path,
    init_db,
    is_mysql,
    update_review_poster,
)
from services.user_service import storage as user_storage


class TestReviewStorage(unittest.TestCase):
    def setUp(self):
        init_db()
        clear_db()

    def tearDown(self):
        clear_db()

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

    def test_review_database_connection(self):
        with get_connection() as conn:
            conn.execute("SELECT 1")

    def test_is_mysql_detection(self):
        self.assertFalse(is_mysql())

        old_dp = os.environ.get("REVIEW_DATABASE_PATH")
        old_legacy_dp = os.environ.get("DATABASE_PATH")
        old_host = os.environ.get("REVIEW_DB_HOST")
        old_type = os.environ.get("DB_TYPE")
        try:
            os.environ.pop("REVIEW_DATABASE_PATH", None)
            os.environ.pop("DATABASE_PATH", None)
            os.environ["REVIEW_DB_HOST"] = "10.0.0.1"
            self.assertTrue(is_mysql())

            os.environ.pop("REVIEW_DB_HOST", None)
            os.environ["DB_TYPE"] = "mysql"
            self.assertTrue(is_mysql())

            os.environ["DB_TYPE"] = "sqlite"
            self.assertFalse(is_mysql())
        finally:
            if old_dp is not None:
                os.environ["REVIEW_DATABASE_PATH"] = old_dp
            else:
                os.environ.pop("REVIEW_DATABASE_PATH", None)
            if old_legacy_dp is not None:
                os.environ["DATABASE_PATH"] = old_legacy_dp
            else:
                os.environ.pop("DATABASE_PATH", None)
            if old_host is not None:
                os.environ["REVIEW_DB_HOST"] = old_host
            else:
                os.environ.pop("REVIEW_DB_HOST", None)
            if old_type is not None:
                os.environ["DB_TYPE"] = old_type
            else:
                os.environ.pop("DB_TYPE", None)

    def test_get_sqlite_path(self):
        old_dp = os.environ.get("REVIEW_DATABASE_PATH")
        try:
            os.environ["REVIEW_DATABASE_PATH"] = "/custom/path/reviews.sqlite"
            self.assertEqual(get_sqlite_path(), "/custom/path/reviews.sqlite")

            os.environ.pop("REVIEW_DATABASE_PATH", None)
            old_legacy = os.environ.pop("DATABASE_PATH", None)
            try:
                default_path = get_sqlite_path()
                self.assertTrue(default_path.endswith("reviews.db"))
            finally:
                if old_legacy is not None:
                    os.environ["DATABASE_PATH"] = old_legacy
        finally:
            if old_dp is not None:
                os.environ["REVIEW_DATABASE_PATH"] = old_dp

    def test_get_database_url_and_engine(self):
        from unittest.mock import patch

        sqlite_url = get_database_url()
        self.assertTrue(sqlite_url.startswith("sqlite:///"))

        with patch("services.review_service.storage.connection.is_mysql", return_value=True):
            mysql_url = get_database_url()
            self.assertTrue(mysql_url.startswith("mysql+pymysql://"))

        engine = get_engine()
        self.assertIsNotNone(engine)

    def test_database_per_service_isolation(self):
        user_storage.init_db()
        init_db()

        user_inspector = inspect(user_storage.get_engine())
        review_inspector = inspect(get_engine())

        user_tables = set(user_inspector.get_table_names())
        review_tables = set(review_inspector.get_table_names())

        self.assertIn("users", user_tables)
        self.assertNotIn("reviews", user_tables)

        self.assertIn("reviews", review_tables)
        self.assertNotIn("users", review_tables)

        self.assertNotEqual(user_storage.get_database_url(), get_database_url())


if __name__ == "__main__":
    unittest.main()
