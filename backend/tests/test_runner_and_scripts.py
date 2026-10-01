import unittest
from unittest.mock import MagicMock, patch

from run_all import (
    _warm_cache,
    start_movie_service,
    start_review_service,
    start_user_service,
)
from services import storage


class TestRunnerAndScripts(unittest.TestCase):
    def setUp(self):
        storage.init_db()
        storage.clear_db()

    def tearDown(self):
        storage.clear_db()

    def test_run_all_start_services(self):
        with patch("grpc.server") as mock_grpc:
            mock_srv = MagicMock()
            mock_grpc.return_value = mock_srv

            usr_srv = start_user_service()
            self.assertEqual(usr_srv, mock_srv)
            self.assertTrue(mock_srv.start.called)

            mock_srv.reset_mock()
            rev_srv = start_review_service()
            self.assertEqual(rev_srv, mock_srv)
            self.assertTrue(mock_srv.start.called)

            mock_srv.reset_mock()
            mov_srv = start_movie_service()
            self.assertEqual(mov_srv, mock_srv)
            self.assertTrue(mock_srv.start.called)

    def test_run_all_warm_cache(self):
        with patch("services.tmdb.get_trending_movies") as mock_trend:
            with patch("services.tmdb.get_now_playing_movies") as mock_np:
                with patch("services.tmdb.get_trending_tv") as mock_tv:
                    _warm_cache()
                    self.assertTrue(mock_trend.called)
                    self.assertTrue(mock_np.called)
                    self.assertTrue(mock_tv.called)

    def test_run_all_warm_cache_handles_exception(self):
        with patch("services.tmdb.get_trending_movies", side_effect=Exception("Cache error")):
            # Should catch and log warning without raising
            _warm_cache()


if __name__ == "__main__":
    unittest.main()
