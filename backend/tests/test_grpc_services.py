import os
import sys
import unittest
from unittest.mock import MagicMock, patch

import grpc

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from generated import movie_pb2 as m_pb2
from generated import review_pb2 as r_pb2
from generated import user_pb2 as u_pb2
from services.movie_service import (
    MovieServiceServicer,
    _fetch_batch_movie_stats_via_grpc,
    _fetch_movie_stats_via_grpc,
)
from services.review_service import ReviewServiceServicer
from services.review_service import storage as review_storage
from services.user_service import UserServiceServicer
from services.user_service import storage as user_storage


class TestGRPCServices(unittest.TestCase):
    def setUp(self):
        user_storage.init_db()
        review_storage.init_db()
        user_storage.clear_db()
        review_storage.clear_db()

    def tearDown(self):
        user_storage.clear_db()
        review_storage.clear_db()

    # ----------------- ReviewServiceServicer Direct Tests ----------------- #
    def test_review_servicer_create_review_invalid_rating(self):
        servicer = ReviewServiceServicer()
        req = r_pb2.CreateReviewRequest(tmdb_id=1, user_id="u", rating=6.0)
        res = servicer.CreateReview(req, None)
        self.assertFalse(res.success)
        self.assertIn("0.5 e 5.0", res.message)

        req_low = r_pb2.CreateReviewRequest(tmdb_id=1, user_id="u", rating=0.2)
        res_low = servicer.CreateReview(req_low, None)
        self.assertFalse(res_low.success)

    def test_review_servicer_create_review_empty_user_id(self):
        servicer = ReviewServiceServicer()
        req = r_pb2.CreateReviewRequest(tmdb_id=1, user_id="   ", rating=4.0)
        res = servicer.CreateReview(req, None)
        self.assertFalse(res.success)
        self.assertIn("em branco", res.message)

    def test_review_servicer_get_movie_stats(self):
        review_storage.add_review(tmdb_id=701, user_id="u1", rating=4.0)
        review_storage.add_review(tmdb_id=701, user_id="u2", rating=5.0)

        servicer = ReviewServiceServicer()
        req = r_pb2.MovieStatsRequest(tmdb_id=701)
        res = servicer.GetMovieStats(req, None)
        self.assertEqual(res.tmdb_id, 701)
        self.assertEqual(res.average_rating, 4.5)
        self.assertEqual(res.total_count, 2)

    def test_review_servicer_get_reviews_by_movie(self):
        review_storage.add_review(tmdb_id=702, user_id="u1", rating=4.0, comment="Rev 1")
        review_storage.add_review(tmdb_id=702, user_id="u2", rating=3.0, comment="Rev 2")

        servicer = ReviewServiceServicer()
        req = r_pb2.MovieReviewsRequest(tmdb_id=702)
        res = servicer.GetReviewsByMovie(req, None)
        self.assertEqual(res.total_count, 2)
        self.assertEqual(len(res.reviews), 2)
        self.assertEqual(res.reviews[0].tmdb_id, 702)

    # ----------------- MovieServiceServicer Direct Tests ----------------- #
    def test_movie_servicer_trending_tv(self):
        servicer = MovieServiceServicer()
        with patch("services.tmdb.get_trending_tv") as mock_tv:
            mock_tv.return_value = {
                "page": 1,
                "total_pages": 1,
                "total_results": 1,
                "results": [{"id": 1396, "title": "Breaking Bad", "poster_url": "/bb.jpg"}],
            }
            req = m_pb2.TrendingMoviesRequest(time_window="week", page=1)
            res = servicer.GetTrendingTV(req, None)
            self.assertEqual(res.page, 1)
            self.assertEqual(len(res.movies), 1)
            self.assertEqual(res.movies[0].title, "Breaking Bad")

    def test_movie_servicer_now_playing(self):
        servicer = MovieServiceServicer()
        with patch("services.tmdb.get_now_playing_movies") as mock_np:
            mock_np.return_value = {
                "page": 1,
                "total_pages": 1,
                "total_results": 1,
                "results": [{"id": 550, "title": "Fight Club", "poster_url": "/fc.jpg"}],
            }
            req = m_pb2.NowPlayingRequest(page=1)
            res = servicer.GetNowPlayingMovies(req, None)
            self.assertEqual(len(res.movies), 1)
            self.assertEqual(res.movies[0].tmdb_id, 550)

    def test_movie_servicer_recommendations(self):
        servicer = MovieServiceServicer()
        with patch("services.tmdb.get_recommendations_for_user") as mock_recs:
            mock_recs.return_value = {
                "page": 1,
                "total_pages": 1,
                "total_results": 1,
                "results": [{"id": 680, "title": "Pulp Fiction", "poster_url": "/pf.jpg"}],
            }
            req = m_pb2.RecommendationsRequest(user_id="cinephile", page=1)
            res = servicer.GetRecommendations(req, None)
            self.assertEqual(len(res.movies), 1)
            self.assertEqual(res.movies[0].title, "Pulp Fiction")

    def test_movie_servicer_season_episodes(self):
        servicer = MovieServiceServicer()
        with patch("services.tmdb.get_season_episodes") as mock_season:
            mock_season.return_value = {
                "season_number": 1,
                "name": "Temporada 1",
                "episodes": [
                    {
                        "episode_number": 1,
                        "name": "Pilot",
                        "air_date": "2008-01-20",
                        "overview": "Pilot ep",
                        "still_url": "/still.jpg",
                        "vote_average": 8.5,
                    }
                ],
            }
            req = m_pb2.SeasonEpisodesRequest(tmdb_id=1396, season_number=1)
            res = servicer.GetSeasonEpisodes(req, None)
            self.assertEqual(len(res.episodes), 1)
            self.assertEqual(res.episodes[0].name, "Pilot")
            self.assertEqual(res.episodes[0].episode_number, 1)

    def test_movie_servicer_all_episodes(self):
        servicer = MovieServiceServicer()
        with patch("services.tmdb.get_all_series_episodes") as mock_all:
            mock_all.return_value = {
                "1": [
                    {
                        "episode_number": 1,
                        "name": "Pilot",
                        "air_date": "2008-01-20",
                        "overview": "Pilot ep",
                        "still_url": "/still.jpg",
                        "vote_average": 8.5,
                    }
                ]
            }
            req = m_pb2.AllEpisodesRequest(tmdb_id=1396)
            res = servicer.GetAllEpisodes(req, None)
            self.assertIn("1", res.seasons)
            self.assertEqual(len(res.seasons["1"].episodes), 1)

    # ----------------- Interservice gRPC Fallback Tests ----------------- #
    def test_fetch_movie_stats_grpc_fallback_on_rpc_error(self):
        with patch("services.movie_service._get_review_stub") as mock_get_stub:
            mock_stub = MagicMock()
            mock_stub.GetMovieStats.side_effect = grpc.RpcError("Connection failed")
            mock_get_stub.return_value = mock_stub

            avg, count = _fetch_movie_stats_via_grpc(550)
            self.assertEqual(avg, 0.0)
            self.assertEqual(count, 0)

    def test_fetch_batch_movie_stats_empty_input(self):
        res = _fetch_batch_movie_stats_via_grpc([])
        self.assertEqual(res, {})

    def test_movie_servicer_tv_with_airing_episodes(self):
        servicer = MovieServiceServicer()
        with patch("services.tmdb.get_movie_details") as mock_details:
            mock_details.return_value = {
                "id": 1396,
                "title": "Breaking Bad",
                "media_type": "tv",
                "last_episode_to_air": {
                    "episode_number": 16,
                    "season_number": 5,
                    "name": "Felina",
                    "air_date": "2013-09-29",
                    "overview": "Series Finale",
                    "still_url": "/felina.jpg",
                    "vote_average": 9.9,
                },
                "next_episode_to_air": {
                    "episode_number": 1,
                    "season_number": 6,
                    "name": "Bonus Ep",
                    "air_date": "2025-01-01",
                    "overview": "Bonus",
                    "still_url": "/bonus.jpg",
                    "vote_average": 8.0,
                },
            }
            with patch("services.movie_service._fetch_movie_stats_via_grpc", return_value=(4.8, 100)):
                req = m_pb2.MovieDetailsRequest(tmdb_id=1396, media_type="tv")
                res = servicer.GetMovieDetails(req, None)
                self.assertTrue(res.found)
                self.assertEqual(res.last_episode_to_air.name, "Felina")
                self.assertEqual(res.next_episode_to_air.name, "Bonus Ep")

    # ----------------- ReviewService Premiere & Backfill Tests ----------------- #
    def test_review_servicer_create_review_unreleased_title(self):
        servicer = ReviewServiceServicer()
        with patch("services.tmdb.get_movie_details") as mock_details:
            mock_details.return_value = {
                "id": 888,
                "title": "Future Movie",
                "release_date": "2099-12-31",
            }
            req = r_pb2.CreateReviewRequest(tmdb_id=888, user_id="u_future", rating=4.5)
            res = servicer.CreateReview(req, None)
            self.assertFalse(res.success)
            self.assertIn("ainda não estreou", res.message)

    def test_review_servicer_create_review_details_and_title_exceptions(self):
        servicer = ReviewServiceServicer()
        # tmdb.get_movie_details raises Exception, get_movie_title raises Exception
        with patch("services.tmdb.get_movie_details", side_effect=Exception("API Error")):
            with patch("services.tmdb.get_movie_title", side_effect=Exception("API Error")):
                req = r_pb2.CreateReviewRequest(
                    tmdb_id=999,
                    user_id="u_err",
                    rating=4.0,
                    comment="Test",
                )
                res = servicer.CreateReview(req, None)
                self.assertTrue(res.success)

    def test_review_servicer_poster_backfill_and_exceptions(self):
        review_storage.add_review(tmdb_id=550, user_id="u_backfill", rating=4.0, poster_url="")

        servicer = ReviewServiceServicer()

        # 1. GetAllReviews backfill success
        with patch("services.tmdb.get_movie_details") as mock_details:
            mock_details.return_value = {"poster_url": "https://image.tmdb.org/t/p/w500/backfilled.jpg"}
            res = servicer.GetAllReviews(r_pb2.GetAllReviewsRequest(), None)
            self.assertEqual(len(res.reviews), 1)
            self.assertEqual(res.reviews[0].poster_url, "https://image.tmdb.org/t/p/w500/backfilled.jpg")

        # Clear poster again
        user_storage.clear_db()
        review_storage.clear_db()
        review_storage.add_review(tmdb_id=550, user_id="u_backfill", rating=4.0, poster_url="")

        # 2. GetReviewsByMovie backfill with exception
        with patch("services.tmdb.get_movie_details", side_effect=Exception("Poster fetch failed")):
            res_movie = servicer.GetReviewsByMovie(r_pb2.MovieReviewsRequest(tmdb_id=550), None)
            self.assertEqual(len(res_movie.reviews), 1)
            self.assertEqual(res_movie.reviews[0].poster_url, "")

        # 3. GetReviewsByUser backfill with exception
        with patch("services.tmdb.get_movie_details", side_effect=Exception("Poster fetch failed")):
            res_user = servicer.GetReviewsByUser(r_pb2.UserReviewsRequest(user_id="u_backfill"), None)
            self.assertEqual(len(res_user.reviews), 1)
            self.assertEqual(res_user.reviews[0].poster_url, "")

    # ----------------- Service Serve Lifecycle Tests ----------------- #
    def test_service_serve_functions(self):
        from services.movie_service import serve as serve_movie
        from services.review_service import serve as serve_review
        from services.user_service import serve as serve_user

        with patch("grpc.server") as mock_grpc_server:
            mock_srv = MagicMock()
            mock_grpc_server.return_value = mock_srv
            mock_srv.wait_for_termination.return_value = None

            serve_user()
            self.assertTrue(mock_srv.start.called)

            mock_srv.reset_mock()
            serve_movie()
            self.assertTrue(mock_srv.start.called)

            mock_srv.reset_mock()
            serve_review()
            self.assertTrue(mock_srv.start.called)

    # ----------------- Additional Servicer RPC Tests ----------------- #
    def test_user_servicer_auth(self):
        servicer = UserServiceServicer()
        # Register user
        reg_req = u_pb2.RegisterUserRequest(username="rpc_user", password="password123")
        reg_res = servicer.RegisterUser(reg_req, None)
        self.assertTrue(reg_res.success)
        self.assertEqual(reg_res.username, "rpc_user")

        # Authenticate user
        auth_req = u_pb2.AuthenticateUserRequest(username="rpc_user", password="password123")
        auth_res = servicer.AuthenticateUser(auth_req, None)
        self.assertTrue(auth_res.success)
        self.assertEqual(auth_res.username, "rpc_user")

    def test_review_servicer_batch_stats(self):
        servicer = ReviewServiceServicer()
        review_storage.add_review(tmdb_id=111, user_id="rpc_user", rating=4.0)
        review_storage.add_review(tmdb_id=222, user_id="rpc_user", rating=5.0)
        batch_req = r_pb2.BatchMovieStatsRequest(tmdb_ids=[111, 222])
        batch_res = servicer.GetBatchMovieStats(batch_req, None)
        self.assertIn(111, batch_res.stats)
        self.assertEqual(batch_res.stats[111].average_rating, 4.0)
        self.assertIn(222, batch_res.stats)
        self.assertEqual(batch_res.stats[222].average_rating, 5.0)

    def test_movie_servicer_search_trending_and_providers(self):

        servicer = MovieServiceServicer()

        # SearchMovies
        with patch("services.tmdb.search_movies") as mock_search:
            mock_search.return_value = {
                "page": 1,
                "total_pages": 1,
                "total_results": 1,
                "results": [{"id": 550, "title": "Fight Club", "poster_url": "/fc.jpg"}],
            }
            res = servicer.SearchMovies(m_pb2.SearchMoviesRequest(query="Fight", page=1), None)
            self.assertEqual(len(res.movies), 1)
            self.assertEqual(res.movies[0].title, "Fight Club")

        # GetTrendingMovies
        with patch("services.tmdb.get_trending_movies") as mock_trend:
            mock_trend.return_value = {
                "page": 1,
                "total_pages": 1,
                "total_results": 1,
                "results": [{"id": 680, "title": "Pulp Fiction", "poster_url": "/pf.jpg"}],
            }
            res_trend = servicer.GetTrendingMovies(m_pb2.TrendingMoviesRequest(time_window="day", page=1), None)

            self.assertEqual(len(res_trend.movies), 1)

        # GetNowPlayingMovies
        with patch("services.tmdb.get_now_playing_movies") as mock_np:
            mock_np.return_value = {
                "page": 1,
                "total_pages": 1,
                "total_results": 1,
                "results": [{"id": 100, "title": "Now Playing", "poster_url": "/np.jpg"}],
            }
            res_np = servicer.GetNowPlayingMovies(m_pb2.NowPlayingRequest(page=1), None)
            self.assertEqual(len(res_np.movies), 1)

        # GetMovieDetails Not Found
        with patch("services.tmdb.get_movie_details", return_value=None):
            with patch("services.movie_service._fetch_movie_stats_via_grpc", return_value=(0.0, 0)):
                res_nf = servicer.GetMovieDetails(m_pb2.MovieDetailsRequest(tmdb_id=999999), None)
                self.assertFalse(res_nf.found)

        # GetMovieDetails with Watch Providers
        with patch("services.tmdb.get_movie_details") as mock_det:
            mock_det.return_value = {
                "id": 550,
                "title": "Fight Club",
                "watch_providers": {
                    "flatrate": [{"provider_name": "Netflix", "logo_url": "/nflx.jpg"}],
                    "rent": [{"provider_name": "Apple TV", "logo_url": "/atv.jpg"}],
                    "buy": [{"provider_name": "Google Play", "logo_url": "/gplay.jpg"}],
                },
            }
            with patch("services.movie_service._fetch_movie_stats_via_grpc", return_value=(4.5, 10)):
                res_wp = servicer.GetMovieDetails(m_pb2.MovieDetailsRequest(tmdb_id=550), None)
                self.assertTrue(res_wp.found)
                self.assertEqual(len(res_wp.watch_providers.flatrate), 1)
                self.assertEqual(res_wp.watch_providers.flatrate[0].provider_name, "Netflix")


if __name__ == "__main__":
    unittest.main()
