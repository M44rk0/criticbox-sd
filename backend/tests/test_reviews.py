import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


from generated import review_pb2 as r_pb2
from services import tmdb as tmdb_service
from services.review_service import ReviewServiceServicer
from services.review_service import storage as database


class TestGetAllReviews(unittest.TestCase):
    def setUp(self):
        database.init_db()
        database.clear_db()

    def tearDown(self):
        database.clear_db()

    def test_database_get_all_reviews(self):
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

        servicer = ReviewServiceServicer()
        request = r_pb2.GetAllReviewsRequest()
        response = servicer.GetAllReviews(request, None)
        self.assertIsInstance(response, r_pb2.GetAllReviewsResponse)
        self.assertEqual(response.total_count, 1)
        self.assertEqual(len(response.reviews), 1)

        first_review = response.reviews[0]
        self.assertEqual(first_review.user_id, "test_servicer_user")
        self.assertEqual(first_review.tmdb_id, 550)
        self.assertTrue(hasattr(first_review, "movie_title"))
        self.assertEqual(first_review.comment, "Ótimo filme!")
        self.assertEqual(first_review.rating, 5.0)

    def test_review_poster_url_and_user_reviews(self):
        res = database.add_review(
            tmdb_id=550,
            user_id="poster_user",
            rating=4.0,
            comment="Com poster!",
            poster_url="https://image.tmdb.org/t/p/w500/test.jpg",
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["poster_url"], "https://image.tmdb.org/t/p/w500/test.jpg")

        reviews = database.get_reviews_by_user("poster_user")
        self.assertEqual(len(reviews), 1)
        self.assertEqual(reviews[0]["poster_url"], "https://image.tmdb.org/t/p/w500/test.jpg")

        servicer = ReviewServiceServicer()
        req = r_pb2.UserReviewsRequest(user_id="poster_user")
        resp = servicer.GetReviewsByUser(req, None)
        self.assertEqual(resp.total_count, 1)
        self.assertEqual(resp.reviews[0].poster_url, "https://image.tmdb.org/t/p/w500/test.jpg")

    def test_database_connection_pool(self):
        import concurrent.futures

        def worker(idx):
            with database.get_connection() as client:
                row = client.execute("SELECT 1 AS num").fetchone()
                return row["num"] if hasattr(row, "keys") else row[0]

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futs = [executor.submit(worker, i) for i in range(10)]
            results = [f.result() for f in futs]
        self.assertEqual(results, [1] * 10)


if __name__ == "__main__":
    unittest.main()
