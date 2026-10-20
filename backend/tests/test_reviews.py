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

    def test_delete_review_database(self):
        res = database.add_review(
            tmdb_id=550,
            user_id="del_user",
            rating=4.0,
            comment="Vou deletar",
        )
        self.assertTrue(res["success"])
        rev_id = res["review_id"]

        # Tentativa de deletar por outro usuário -> deve falhar
        fail_res = database.delete_review(rev_id, user_id="other_user", username="other_user")
        self.assertFalse(fail_res["success"])
        self.assertIn("permissão", fail_res["message"])

        # Deletar pelo dono -> sucesso
        ok_res = database.delete_review(rev_id, user_id="del_user", username="del_user")
        self.assertTrue(ok_res["success"])

        # Tentar deletar novamente -> não encontrada
        not_found_res = database.delete_review(rev_id, user_id="del_user", username="del_user")
        self.assertFalse(not_found_res["success"])
        self.assertIn("não encontrada", not_found_res["message"].lower())

    def test_delete_review_servicer(self):
        res = database.add_review(
            tmdb_id=550,
            user_id="srv_del_user",
            rating=5.0,
            comment="Servicer review",
        )
        self.assertTrue(res["success"])
        rev_id = res["review_id"]

        servicer = ReviewServiceServicer()

        # Tentativa inválida
        req_fail = r_pb2.DeleteReviewRequest(review_id=rev_id, user_id="stranger", username="stranger")
        resp_fail = servicer.DeleteReview(req_fail, None)
        self.assertFalse(resp_fail.success)

        # Tentativa válida
        req_ok = r_pb2.DeleteReviewRequest(review_id=rev_id, user_id="srv_del_user", username="srv_del_user")
        resp_ok = servicer.DeleteReview(req_ok, None)
        self.assertTrue(resp_ok.success)

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

