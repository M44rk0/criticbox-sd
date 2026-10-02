import unittest
from unittest.mock import MagicMock, patch

from run_all import (
    _warm_cache,
    start_movie_service,
    start_review_service,
    start_user_service,
)
from services.review_service import storage as review_storage
from services.user_service import storage as user_storage


class TestRunnerAndScripts(unittest.TestCase):
    def setUp(self):
        user_storage.init_db()
        review_storage.init_db()
        user_storage.clear_db()
        review_storage.clear_db()

    def tearDown(self):
        user_storage.clear_db()
        review_storage.clear_db()

    def test_run_all_start_services(self):
        with patch("grpc.server") as mock_grpc:
            mock_srv = MagicMock()
            mock_grpc.return_value = mock_srv

            usr_srv = start_user_service()
            self.assertEqual(usr_srv, mock_srv)
            self.assertTrue(mock_srv.start.called)

            mock_srv.reset_mock()
            mov_srv = start_movie_service()
            self.assertEqual(mov_srv, mock_srv)
            self.assertTrue(mock_srv.start.called)

            mock_srv.reset_mock()
            rev_srv = start_review_service()
            self.assertEqual(rev_srv, mock_srv)
            self.assertTrue(mock_srv.start.called)

    def test_warm_cache_handles_exceptions_gracefully(self):
        with patch("services.tmdb.get_trending_movies", side_effect=Exception("API down")):
            with patch("services.tmdb.get_now_playing_movies", side_effect=Exception("API down")):
                try:
                    _warm_cache()
                except Exception as e:
                    self.fail(f"_warm_cache não deveria levantar exceção: {e}")


if __name__ == "__main__":
    unittest.main()
