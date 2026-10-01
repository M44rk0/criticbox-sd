import unittest
from unittest.mock import MagicMock, patch

from criticbox_sd.run_all import (
    _warm_cache,
    start_movie_service,
    start_review_service,
    start_user_service,
)
from criticbox_sd.scripts.backfill_posters import backfill
from criticbox_sd.server import storage


class TestRunnerAndScripts(unittest.TestCase):
    def setUp(self):
        storage.init_db()
        storage.clear_db()

    def tearDown(self):
        storage.clear_db()

    def test_backfill_posters_updates_empty_posters(self):
        res = storage.add_review(tmdb_id=550, user_id="user_script", rating=4.0, poster_url="")
        self.assertTrue(res["success"])

        with patch("criticbox_sd.server.tmdb.get_movie_details") as mock_details:
            mock_details.return_value = {
                "id": 550,
                "title": "Fight Club",
                "poster_url": "https://image.tmdb.org/t/p/w500/backfilled_script.jpg",
            }
            backfill()

        revs = storage.get_all_reviews(limit=1)
        self.assertEqual(revs[0]["poster_url"], "https://image.tmdb.org/t/p/w500/backfilled_script.jpg")

    def test_backfill_posters_handles_exceptions(self):
        storage.add_review(tmdb_id=999, user_id="user_err_script", rating=4.0, poster_url="")

        with patch("criticbox_sd.server.tmdb.get_movie_details", side_effect=Exception("API failure")):
            backfill()

        revs = storage.get_all_reviews(limit=1)
        self.assertEqual(revs[0]["poster_url"], "")

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
        with patch("criticbox_sd.server.tmdb.get_trending_movies") as mock_trend:
            with patch("criticbox_sd.server.tmdb.get_now_playing_movies") as mock_np:
                with patch("criticbox_sd.server.tmdb.get_trending_tv") as mock_tv:
                    _warm_cache()
                    self.assertTrue(mock_trend.called)
                    self.assertTrue(mock_np.called)
                    self.assertTrue(mock_tv.called)

    def test_run_all_warm_cache_handles_exception(self):
        with patch("criticbox_sd.server.tmdb.get_trending_movies", side_effect=Exception("Cache error")):
            # Should catch and log warning without raising
            _warm_cache()


if __name__ == "__main__":
    unittest.main()
