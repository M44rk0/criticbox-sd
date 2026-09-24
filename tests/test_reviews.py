import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.extend(
    [
        os.path.join(BASE_DIR, "criticbox_sd"),
        os.path.join(BASE_DIR, "criticbox_sd", "server"),
        os.path.join(BASE_DIR, "criticbox_sd", "generated"),
        os.path.join(BASE_DIR, "criticbox_sd", "client"),
    ]
)

os.environ["DATABASE_PATH"] = os.path.join(BASE_DIR, "tests", "criticbox_test.db")

import criticbox_pb2 as pb2
import database
import server
import tmdb_service



class TestGetAllReviews(unittest.TestCase):
    def setUp(self):
        database.init_db()
        database.clear_db()

    def tearDown(self):
        database.clear_db()

    def test_database_get_all_reviews(self):
        # Insert a sample review
        res = database.add_review(
            tmdb_id=550,
            user_id="test_user_all",
            rating=4.5,
            comment="Excelente filme!",
            contains_spoilers=False,
        )
        self.assertTrue(res["success"])

        all_reviews = database.get_all_reviews()
        self.assertEqual(len(all_reviews), 1)
        self.assertEqual(all_reviews[0]["user_id"], "test_user_all")
        self.assertEqual(all_reviews[0]["tmdb_id"], 550)

    def test_tmdb_service_get_movie_title(self):
        title = tmdb_service.get_movie_title(550)
        self.assertIsInstance(title, str)
        self.assertGreater(len(title), 0)

    def test_servicer_get_all_reviews(self):
        database.add_review(
            tmdb_id=550,
            user_id="test_servicer_user",
            rating=5.0,
            comment="Ótimo filme!",
            contains_spoilers=False,
        )

        servicer = server.CriticboxServicer()
        request = pb2.GetAllReviewsRequest()
        response = servicer.GetAllReviews(request, None)
        self.assertIsInstance(response, pb2.GetAllReviewsResponse)
        self.assertEqual(response.total_count, 1)
        self.assertEqual(len(response.reviews), 1)

        first_review = response.reviews[0]
        self.assertEqual(first_review.user_id, "test_servicer_user")
        self.assertEqual(first_review.tmdb_id, 550)
        self.assertTrue(hasattr(first_review, "movie_title"))
        self.assertEqual(first_review.comment, "Ótimo filme!")
        self.assertEqual(first_review.rating, 5.0)


if __name__ == "__main__":
    unittest.main()
