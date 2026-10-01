import os
import sys
import time
import unittest
from unittest.mock import patch

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from criticbox_sd.server import storage
from criticbox_sd.server.tmdb import (
    _CACHE,
    _extract_certification,
    _extract_crew,
    _extract_photos_and_logo,
    _extract_recommendations,
    _extract_watch_providers,
    _fmt,
    _get_from_cache,
    _set_cache,
    clear_cache,
    get_all_series_episodes,
    get_movie_details,
    get_movie_title,
    get_now_playing_movies,
    get_recommendations_for_user,
    get_season_episodes,
    get_trending_movies,
    get_trending_tv,
    search_movies,
)
from criticbox_sd.server.tmdb.cache import MAX_CACHE_SIZE
from criticbox_sd.server.tmdb.recommender import _fetch_seed_recommendations


class TestTMDBModule(unittest.TestCase):
    def setUp(self):
        clear_cache()
        storage.init_db()
        storage.clear_db()

    def tearDown(self):
        clear_cache()
        storage.clear_db()

    # ----------------- Cache Tests ----------------- #
    def test_cache_set_and_get(self):
        _set_cache("test_key", {"data": 123})
        self.assertEqual(_get_from_cache("test_key"), {"data": 123})

    def test_cache_expiration(self):
        _CACHE["exp_key"] = (time.time() - 1000.0, {"data": "expired"})
        self.assertIsNone(_get_from_cache("exp_key"))

    def test_clear_cache(self):
        _set_cache("key1", "val1")
        _set_cache("key2", "val2")
        clear_cache()
        self.assertIsNone(_get_from_cache("key1"))
        self.assertIsNone(_get_from_cache("key2"))

    # ----------------- Extractors Tests ----------------- #
    def test_fmt_movie(self):
        raw = {
            "id": 10,
            "title": "Inception",
            "poster_path": "/poster.jpg",
            "backdrop_path": "/backdrop.jpg",
            "overview": "Dreams within dreams",
            "vote_average": 8.8,
            "release_date": "2010-07-16",
        }
        res = _fmt(raw, default_media_type="movie")
        self.assertEqual(res["tmdb_id"], 10)
        self.assertEqual(res["title"], "Inception")
        self.assertIn("/poster.jpg", res["poster_url"])
        self.assertIn("/backdrop.jpg", res["backdrop_url"])
        self.assertEqual(res["media_type"], "movie")

    def test_fmt_tv_fallback_name(self):
        raw = {
            "id": 20,
            "name": "Breaking Bad",
            "first_air_date": "2008-01-20",
        }
        res = _fmt(raw, default_media_type="tv")
        self.assertEqual(res["title"], "Breaking Bad")
        self.assertEqual(res["release_date"], "2008-01-20")
        self.assertEqual(res["media_type"], "tv")

    def test_extract_certification_br_and_us(self):
        # Movie BR release
        data_br = {
            "release_dates": {
                "results": [
                    {"iso_3166_1": "BR", "release_dates": [{"certification": "16"}]},
                ]
            }
        }
        self.assertEqual(_extract_certification(data_br, is_movie=True), "16")

        # Movie US release fallback
        data_us = {
            "release_dates": {
                "results": [
                    {"iso_3166_1": "US", "release_dates": [{"certification": "PG-13"}]},
                ]
            }
        }
        self.assertEqual(_extract_certification(data_us, is_movie=True), "PG-13")

        # TV content rating BR
        data_tv_br = {
            "content_ratings": {
                "results": [
                    {"iso_3166_1": "BR", "rating": "18"},
                ]
            }
        }
        self.assertEqual(_extract_certification(data_tv_br, is_movie=False), "18")

        # Empty fallback
        self.assertEqual(_extract_certification({}, is_movie=True), "")

    def test_extract_crew(self):
        crew_list = [
            {"job": "Screenplay", "name": "Writer 1"},
            {"job": "Screenplay", "name": "Writer 1"},  # duplicate
            {"job": "Writer", "name": "Writer 2"},
            {"job": "Original Music Composer", "name": "Hans Zimmer"},
            {"job": "Director of Photography", "name": "Roger Deakins"},
            {"job": "Producer", "name": "Emma Thomas"},
            {"job": "Other Role", "name": "Nobody"},
        ]
        res = _extract_crew(crew_list)
        self.assertEqual(res["writers"], ["Writer 1", "Writer 2"])
        self.assertEqual(res["music_composers"], ["Hans Zimmer"])
        self.assertEqual(res["cinematographers"], ["Roger Deakins"])
        self.assertEqual(res["producers"], ["Emma Thomas"])

    def test_extract_watch_providers(self):
        providers_data = {
            "results": {
                "BR": {
                    "flatrate": [{"provider_name": "Netflix", "logo_path": "/netflix.png"}],
                    "rent": [{"provider_name": "Apple TV", "logo_path": "/apple.png"}],
                    "buy": [],
                }
            }
        }
        wp = _extract_watch_providers(providers_data)
        self.assertEqual(len(wp["flatrate"]), 1)
        self.assertEqual(wp["flatrate"][0]["provider_name"], "Netflix")
        self.assertEqual(len(wp["rent"]), 1)
        self.assertEqual(len(wp["buy"]), 0)

    def test_extract_photos_and_logo(self):
        images_data = {
            "logos": [
                {"file_path": "/logo_en.png", "iso_639_1": "en", "vote_average": 5.0},
                {"file_path": "/logo_pt.png", "iso_639_1": "pt", "vote_average": 9.0},
            ],
            "backdrops": [
                {"file_path": "/backdrop1.jpg"},
                {"file_path": "/backdrop2.jpg"},
            ],
        }
        logo_url, photos = _extract_photos_and_logo(images_data)
        self.assertIn("/logo_pt.png", logo_url)
        self.assertEqual(len(photos), 2)

    def test_extract_recommendations(self):
        recs_data = {
            "results": [
                {"id": 1, "title": "Rec 1", "poster_path": "/p1.jpg"},
                {"id": 2, "title": "Rec 2", "poster_path": ""},  # No poster should be filtered
                {"id": 3, "title": "Rec 3", "poster_path": "/p3.jpg"},
            ]
        }
        recs = _extract_recommendations(recs_data)
        self.assertEqual(len(recs), 2)
        self.assertEqual(recs[0]["tmdb_id"], 1)
        self.assertEqual(recs[1]["tmdb_id"], 3)

    # ----------------- Recommender Engine Tests ----------------- #
    def test_recommender_anonymous_fallback_to_top_rated(self):
        with patch("tmdbsimple.Movies.top_rated") as mock_top:
            mock_top.return_value = {
                "results": [
                    {"id": 500, "title": "Top Movie 1", "poster_path": "/top1.jpg"},
                    {"id": 501, "title": "Top Movie 2", "poster_path": "/top2.jpg"},
                ]
            }
            res = get_recommendations_for_user(user_id=None, page=1)
            self.assertIn("results", res)
            self.assertGreaterEqual(len(res["results"]), 1)

    def test_recommender_with_user_reviews(self):
        storage.create_user("cinephile_test", "password123")
        storage.add_review(tmdb_id=550, user_id="cinephile_test", rating=5.0)
        storage.add_review(tmdb_id=680, user_id="cinephile_test", rating=4.5)

        with patch("criticbox_sd.server.tmdb.recommender._fetch_seed_recommendations") as mock_seed:
            mock_seed.return_value = [
                {"id": 991, "title": "Rec For 550", "poster_path": "/r1.jpg", "genre_ids": [28, 18]},
                {"id": 992, "title": "Rec For 680", "poster_path": "/r2.jpg", "genre_ids": [18, 53]},
            ]
            res = get_recommendations_for_user(user_id="cinephile_test", page=1)
            self.assertIn("results", res)
            ids = [r["id"] for r in res["results"]]
            # Reviewed IDs must be excluded
            self.assertNotIn(550, ids)
            self.assertNotIn(680, ids)

    def test_fetch_seed_recommendations_mock(self):
        with patch("tmdbsimple.Movies.recommendations") as mock_rec:
            mock_rec.return_value = {"results": [{"id": 77, "title": "Seed Rec", "poster_path": "/seed.jpg"}]}
            items = _fetch_seed_recommendations(550, "movie", page=1)
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["id"], 77)

    # ----------------- Catalog Methods Tests ----------------- #
    def test_search_movies_empty_query(self):
        res = search_movies("   ")
        self.assertEqual(res["total_results"], 0)
        self.assertEqual(res["results"], [])

    def test_get_movie_title_fallback(self):
        with patch("criticbox_sd.server.tmdb.catalog.get_movie_details", return_value=None):
            title = get_movie_title(888888)
            self.assertEqual(title, "Título #888888")

    def test_get_all_series_episodes_seasons_hint(self):
        with patch("criticbox_sd.server.tmdb.catalog.get_season_episodes") as mock_season:
            mock_season.return_value = {
                "season_number": 1,
                "episodes": [{"episode_number": 1, "name": "Pilot"}],
            }
            res = get_all_series_episodes(1396, seasons_hint=[1])
            self.assertIn("1", res)
            self.assertEqual(len(res["1"]), 1)

    # ----------------- Additional Cache & Eviction Tests ----------------- #
    def test_cache_eviction_expired_and_oldest_purge(self):
        now = time.time()
        # Pre-fill cache up to MAX_CACHE_SIZE with some expired keys
        for i in range(10):
            _CACHE[f"expired_{i}"] = (now - 2000.0, f"expired_val_{i}")
        for i in range(MAX_CACHE_SIZE):
            _CACHE[f"active_{i}"] = (now + i, f"active_val_{i}")

        # Adding a new key must trigger purge of expired keys
        _set_cache("overflow_key", "overflow_val")
        self.assertNotIn("expired_0", _CACHE)
        self.assertIn("overflow_key", _CACHE)
        self.assertLessEqual(len(_CACHE), MAX_CACHE_SIZE + 1)

    # ----------------- Additional Extractor Tests ----------------- #
    def test_extract_certification_tv_us_fallback(self):
        # TV content rating with only US
        tv_data = {
            "content_ratings": {
                "results": [
                    {"iso_3166_1": "GB", "rating": "15"},
                    {"iso_3166_1": "US", "rating": "TV-MA"},
                ]
            }
        }
        cert = _extract_certification(tv_data, is_movie=False)
        self.assertEqual(cert, "TV-MA")

        # Movie certification with only US
        movie_data = {
            "release_dates": {"results": [{"iso_3166_1": "US", "release_dates": [{"certification": "PG-13"}]}]}
        }
        cert_movie = _extract_certification(movie_data, is_movie=True)
        self.assertEqual(cert_movie, "PG-13")

        # Empty/missing results
        self.assertEqual(_extract_certification({}, is_movie=True), "")
        self.assertEqual(_extract_certification({}, is_movie=False), "")

    # ----------------- Additional Recommender Tests ----------------- #
    def test_fetch_seed_recommendations_cache_hit_and_tv_and_error(self):
        # Cache hit
        _set_cache("seed_recs:movie:550:1", [{"id": 550, "title": "Cached Seed"}])
        cached = _fetch_seed_recommendations(550, "movie", page=1)
        self.assertEqual(cached[0]["title"], "Cached Seed")

        # TV media type
        with patch("tmdbsimple.TV.recommendations") as mock_tv_rec:
            mock_tv_rec.return_value = {"results": [{"id": 1396, "name": "Breaking Bad Rec", "poster_path": "/bb.jpg"}]}
            tv_recs = _fetch_seed_recommendations(1396, "tv", page=2)
            self.assertEqual(len(tv_recs), 1)
            self.assertEqual(tv_recs[0]["id"], 1396)

        # Exception fallback
        with patch("tmdbsimple.Movies.recommendations", side_effect=RuntimeError("TMDb Down")):
            err_recs = _fetch_seed_recommendations(9999, "movie", page=1)
            self.assertEqual(err_recs, [])

    def test_recommender_api_key_empty_and_cache_hit(self):
        with patch("criticbox_sd.server.tmdb.recommender.API_KEY", ""):
            res = get_recommendations_for_user("user_any", page=1)
            self.assertEqual(res["results"], [])

        # Cache hit
        _set_cache("user_recs:cached_user:1", {"page": 1, "total_results": 1, "results": [{"id": 10}]})
        hit = get_recommendations_for_user("cached_user", page=1)
        self.assertEqual(hit["results"][0]["id"], 10)

    def test_recommender_genre_affinity_and_fallback_exception(self):
        storage.create_user("cine_user_affinity", "password123")
        storage.add_review(tmdb_id=101, user_id="cine_user_affinity", rating=5.0)

        # Pre-seed cached detail with genre IDs to test genre affinity bonus
        _set_cache("details:movie:101", {"genre_ids": [28, 878]})

        with patch("criticbox_sd.server.tmdb.recommender._fetch_seed_recommendations") as mock_seed:
            mock_seed.return_value = [
                {"id": 201, "title": "SciFi Action", "poster_path": "/sf.jpg", "genre_ids": [28, 878]},
                {"id": 202, "title": "Romance", "poster_path": "/ro.jpg", "genre_ids": [10749]},
            ]
            # Mock top_rated failure to test exception handling in fallback
            with patch("tmdbsimple.Movies.top_rated", side_effect=Exception("Top rated failure")):
                res = get_recommendations_for_user("cine_user_affinity", page=1)
                self.assertIn("results", res)
                self.assertGreaterEqual(len(res["results"]), 1)
                # First result should be the one matching seed genre affinity
                self.assertEqual(res["results"][0]["id"], 201)

    # ----------------- Additional Catalog Tests ----------------- #
    def test_catalog_search_movies_cache_and_api_key_and_error(self):
        # Empty API key
        with patch("criticbox_sd.server.tmdb.catalog.API_KEY", ""):
            self.assertEqual(search_movies("Matrix")["results"], [])

        # Cache hit
        _set_cache("search:matrix:1", {"page": 1, "results": [{"id": 603, "title": "The Matrix"}]})
        self.assertEqual(search_movies("matrix", page=1)["results"][0]["title"], "The Matrix")

        # TMDb exception
        import requests

        with patch("tmdbsimple.Search.multi", side_effect=requests.RequestException("Network Error")):
            self.assertEqual(search_movies("avatar", page=1)["results"], [])

    def test_catalog_trending_movies_cache_and_errors(self):
        with patch("criticbox_sd.server.tmdb.catalog.API_KEY", ""):
            self.assertEqual(get_trending_movies()["results"], [])

        _set_cache("trending:week:1", {"page": 1, "results": [{"id": 100}]})
        self.assertEqual(get_trending_movies(time_window="week", page=1)["results"][0]["id"], 100)

        import requests

        with patch("tmdbsimple.Trending.info", side_effect=requests.RequestException):
            self.assertEqual(get_trending_movies(time_window="day", page=1)["results"], [])

    def test_catalog_now_playing_and_trending_tv_cache_and_errors(self):
        # Now playing
        with patch("criticbox_sd.server.tmdb.catalog.API_KEY", ""):
            self.assertEqual(get_now_playing_movies()["results"], [])

        _set_cache("now_playing:1", {"page": 1, "results": [{"id": 101}]})
        self.assertEqual(get_now_playing_movies(page=1)["results"][0]["id"], 101)

        import requests

        with patch("tmdbsimple.Movies.now_playing", side_effect=requests.RequestException):
            self.assertEqual(get_now_playing_movies(page=2)["results"], [])

        # Trending TV
        with patch("criticbox_sd.server.tmdb.catalog.API_KEY", ""):
            self.assertEqual(get_trending_tv()["results"], [])

        _set_cache("trending_tv:week:1", {"page": 1, "results": [{"id": 102}]})
        self.assertEqual(get_trending_tv(time_window="week", page=1)["results"][0]["id"], 102)

        with patch("tmdbsimple.Trending.info", side_effect=requests.RequestException):
            self.assertEqual(get_trending_tv(time_window="day", page=2)["results"], [])

    def test_catalog_get_movie_details_cache_empty_and_tv_fallback(self):
        with patch("criticbox_sd.server.tmdb.catalog.API_KEY", ""):
            self.assertIsNone(get_movie_details(550))

        _set_cache("details::550", {"id": 550, "title": "Fight Club Cached"})
        self.assertEqual(get_movie_details(550)["title"], "Fight Club Cached")

        # TV details fallback when movie raises KeyError
        with patch("tmdbsimple.Movies.info", side_effect=KeyError):
            with patch("tmdbsimple.TV.info") as mock_tv:
                mock_tv.return_value = {
                    "id": 1396,
                    "name": "Breaking Bad",
                    "poster_path": "/bb.jpg",
                    "created_by": [],
                    "credits": {
                        "crew": [{"name": "Vince Gilligan", "job": "Executive Producer"}],
                        "cast": [{"name": "Bryan Cranston", "character": "Walter White", "profile_path": "/p.jpg"}],
                    },
                    "videos": {
                        "results": [
                            {"site": "YouTube", "type": "Trailer", "key": "abc", "iso_639_1": "en"},
                            {"site": "YouTube", "type": "Trailer", "key": "xyz", "iso_639_1": "pt"},
                        ]
                    },
                    "seasons": [
                        {"season_number": 0, "name": "Specials"},
                        {"season_number": 1, "name": "Season 1", "poster_path": "/s1.jpg"},
                    ],
                }
                tv_res = get_movie_details(1396, media_type="tv")
                self.assertIsNotNone(tv_res)
                self.assertEqual(tv_res["title"], "Breaking Bad")
                self.assertIn("Vince Gilligan", tv_res.get("directors", []))
                self.assertEqual(tv_res.get("trailer_url"), "https://www.youtube.com/watch?v=xyz")
                # Season 0 should be filtered out
                self.assertEqual(len(tv_res.get("seasons", [])), 1)

    def test_catalog_get_season_and_all_episodes_branches(self):
        # Season episodes
        with patch("criticbox_sd.server.tmdb.catalog.API_KEY", ""):
            s_res = get_season_episodes(1396, 1)
            self.assertEqual(s_res["episodes"], [])

        _set_cache("episodes:1396:1", {"season_number": 1, "episodes": [{"episode_number": 1}]})
        self.assertEqual(len(get_season_episodes(1396, 1)["episodes"]), 1)

        with patch("tmdbsimple.TV_Seasons.info", side_effect=Exception("Failed")):
            err_season = get_season_episodes(9999, 1)
            self.assertEqual(err_season["episodes"], [])

        # All series episodes
        with patch("criticbox_sd.server.tmdb.catalog.API_KEY", ""):
            self.assertEqual(get_all_series_episodes(1396), {})

        _set_cache("all_episodes:1396", {"1": [{"episode_number": 1}]})
        self.assertEqual(len(get_all_series_episodes(1396)["1"]), 1)

        # seasons_hint with dictionary and invalid season numbers
        with patch("criticbox_sd.server.tmdb.catalog.get_season_episodes") as mock_season:
            mock_season.return_value = {"season_number": 2, "episodes": [{"episode_number": 1}]}
            hinted = get_all_series_episodes(2000, seasons_hint=[{"season_number": 2}, 0, "invalid"])
            self.assertIn("2", hinted)

        # Exception in get_all_series_episodes
        with patch("criticbox_sd.server.tmdb.catalog._get_tv_details", side_effect=Exception):
            self.assertEqual(get_all_series_episodes(99999), {})

    def test_catalog_get_movie_title_details_hit(self):
        _set_cache("title:movie:777", "Oppenheimer")
        self.assertEqual(get_movie_title(777, media_type="movie"), "Oppenheimer")

        with patch("criticbox_sd.server.tmdb.catalog.get_movie_details", return_value={"title": "Inception"}):
            self.assertEqual(get_movie_title(27205, media_type="movie"), "Inception")

    def test_catalog_full_mock_parsers(self):
        # Multi search parser
        with patch("tmdbsimple.Search.multi") as mock_multi:
            mock_multi.return_value = {
                "page": 1,
                "total_pages": 1,
                "total_results": 2,
                "results": [
                    {"id": 1, "title": "Film A", "media_type": "movie", "poster_path": "/a.jpg"},
                    {"id": 2, "name": "Show B", "media_type": "tv", "poster_path": "/b.jpg"},
                    {"id": 3, "name": "Person C", "media_type": "person"},  # Should be filtered
                ],
            }
            res = search_movies("query test", page=1)
            self.assertEqual(len(res["results"]), 2)

        # Movie details parser
        with patch("tmdbsimple.Movies.info") as mock_info:
            mock_info.return_value = {
                "id": 999,
                "title": "Full Movie",
                "poster_path": "/full.jpg",
                "release_dates": {"results": [{"iso_3166_1": "BR", "release_dates": [{"certification": "14"}]}]},
                "credits": {
                    "crew": [
                        {"name": "Famous Director", "job": "Director"},
                        {"name": "Top Writer", "job": "Screenplay"},
                        {"name": "Maestro", "job": "Original Music Composer"},
                    ],
                    "cast": [{"name": "Lead Actor", "character": "Hero", "profile_path": "/lead.jpg"}],
                },
                "images": {"backdrops": [], "logos": []},
                "videos": {"results": []},
                "watch/providers": {"results": {}},
                "recommendations": {"results": []},
                "genres": [{"id": 28, "name": "Ação"}],
                "spoken_languages": [{"name": "Português", "english_name": "Portuguese"}],
            }
            details = get_movie_details(999, media_type="movie")
            self.assertIsNotNone(details)
            self.assertEqual(details["title"], "Full Movie")
            self.assertEqual(details["certification"], "14")
            self.assertIn("Famous Director", details["directors"])
            self.assertIn("Top Writer", details["writers"])
            self.assertIn("Maestro", details["music_composers"])

        # Season episodes parser
        with patch("tmdbsimple.TV_Seasons.info") as mock_sinfo:
            mock_sinfo.return_value = {
                "season_number": 1,
                "poster_path": "/season1.jpg",
                "episodes": [
                    {
                        "episode_number": 1,
                        "name": "Capítulo 1",
                        "crew": [{"name": "Ep Director", "job": "Director"}],
                        "guest_stars": [{"name": "Guest 1", "character": "Cameo", "profile_path": "/g.jpg"}],
                    }
                ],
            }
            sep = get_season_episodes(8888, 1)
            self.assertEqual(len(sep["episodes"]), 1)
            self.assertEqual(sep["episodes"][0]["directors"], ["Ep Director"])
            self.assertEqual(len(sep["episodes"][0]["guest_stars"]), 1)


if __name__ == "__main__":
    unittest.main()
