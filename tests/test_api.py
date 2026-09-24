import os
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ["DATABASE_PATH"] = os.path.join(BASE_DIR, "tests", "criticbox_test.db")

from fastapi.testclient import TestClient

from criticbox_sd.api.main import app
from criticbox_sd.server import database


class TestCriticboxAPI(unittest.TestCase):
    def setUp(self):
        database.init_db()
        database.clear_db()
        self.client = TestClient(app)

    def tearDown(self):
        database.clear_db()

    def test_root_endpoint(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "online")
        self.assertIn("docs_url", data)

    def test_create_review_success_201(self):
        payload = {
            "tmdb_id": 550,
            "user_id": "marcodev",
            "rating": 4.5,
            "comment": "Filme clássico e excelente!",
            "contains_spoilers": False,
        }
        response = self.client.post("/reviews", json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["tmdb_id"], 550)
        self.assertEqual(data["user_id"], "marcodev")
        self.assertEqual(data["rating"], 4.5)
        self.assertEqual(data["comment"], "Filme clássico e excelente!")
        self.assertFalse(data["contains_spoilers"])
        self.assertTrue(len(data["review_id"]) > 0)

        db_reviews = database.get_all_reviews()
        self.assertEqual(len(db_reviews), 1)
        self.assertEqual(db_reviews[0]["review_id"], data["review_id"])

    def test_create_review_invalid_rating_400(self):
        payload = {
            "tmdb_id": 550,
            "user_id": "marcodev",
            "rating": 6.0,
            "comment": "Nota fora do range",
        }
        response = self.client.post("/reviews", json=payload)
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data.get("mensagem"), "Dados inválidos")
        erros = {e["campo"]: e["mensagem"] for e in data.get("erros", [])}
        self.assertIn("rating", erros)
        self.assertIn("0.5 e 5.0", erros["rating"])

    def test_create_review_blank_user_id_400(self):
        payload = {
            "tmdb_id": 550,
            "user_id": "   ",
            "rating": 4.0,
        }
        response = self.client.post("/reviews", json=payload)
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data.get("mensagem"), "Dados inválidos")
        erros = {e["campo"]: e["mensagem"] for e in data.get("erros", [])}
        self.assertIn("user_id", erros)
        self.assertIn("não pode estar em branco", erros["user_id"])

    def test_create_review_invalid_tmdb_id_400(self):
        payload = {
            "tmdb_id": 0,
            "user_id": "marcodev",
            "rating": 4.0,
        }
        response = self.client.post("/reviews", json=payload)
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data.get("mensagem"), "Dados inválidos")
        erros = {e["campo"]: e["mensagem"] for e in data.get("erros", [])}
        self.assertIn("tmdb_id", erros)
        self.assertIn("positivo maior que zero", erros["tmdb_id"])

    def test_create_review_missing_fields_400(self):
        payload = {}
        response = self.client.post("/reviews", json=payload)
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data.get("mensagem"), "Dados inválidos")
        campos_com_erro = [e["campo"] for e in data.get("erros", [])]
        self.assertIn("tmdb_id", campos_com_erro)
        self.assertIn("user_id", campos_com_erro)
        self.assertIn("rating", campos_com_erro)
        for erro in data.get("erros", []):
            self.assertEqual(erro["mensagem"], "Campo obrigatório e não informado.")

    def test_get_all_reviews_200(self):
        database.add_review(550, "alice", 5.0, "Incrível", False)
        database.add_review(680, "bob", 4.0, "Muito bom", True)

        response = self.client.get("/reviews")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 2)
        users = [r["user_id"] for r in data]
        self.assertIn("alice", users)
        self.assertIn("bob", users)

    def test_search_movies_success_200(self):
        response = self.client.get("/movies?query=Fight Club")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("movies", data)
        self.assertIn("total_results", data)
        self.assertIn("page", data)
        self.assertIsInstance(data["movies"], list)

    def test_search_movies_blank_query_400(self):
        response = self.client.get("/movies?query=   ")
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data.get("mensagem"), "Dados inválidos")
        campos_com_erro = [e["campo"] for e in data.get("erros", [])]
        self.assertIn("query", campos_com_erro)

    def test_search_movies_missing_query_400(self):
        response = self.client.get("/movies")
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data.get("mensagem"), "Dados inválidos")
        campos_com_erro = [e["campo"] for e in data.get("erros", [])]
        self.assertIn("query", campos_com_erro)


if __name__ == "__main__":
    unittest.main()
