import os
import sys
import time
import unittest
from concurrent import futures

import grpc

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
os.environ["USER_SERVICE_PORT"] = "50057"
os.environ["MOVIE_SERVICE_PORT"] = "50055"
os.environ["REVIEW_SERVICE_PORT"] = "50056"
os.environ["API_PORT"] = "8000"

from fastapi.testclient import TestClient

from gateway.grpc_clients import GatewayGRPCManager
from gateway.main import app
from generated import movie_pb2_grpc as m_pb2_grpc
from generated import review_pb2_grpc as r_pb2_grpc
from generated import user_pb2_grpc as u_pb2_grpc
from services.movie_service import MovieServiceServicer
from services.review_service import ReviewServiceServicer
from services.review_service import storage as database
from services.user_service import UserServiceServicer
from services.user_service import storage as user_database


class TestCriticboxDistributedAPI(unittest.TestCase):
    user_server = None
    movie_server = None
    review_server = None

    @classmethod
    def setUpClass(cls):
        GatewayGRPCManager._instance = None

        cls.user_server = grpc.server(futures.ThreadPoolExecutor(max_workers=5))
        u_pb2_grpc.add_UserServiceServicer_to_server(UserServiceServicer(), cls.user_server)
        user_port = cls.user_server.add_insecure_port("127.0.0.1:0")
        cls.user_server.start()

        cls.review_server = grpc.server(futures.ThreadPoolExecutor(max_workers=5))
        r_pb2_grpc.add_ReviewServiceServicer_to_server(ReviewServiceServicer(), cls.review_server)
        review_port = cls.review_server.add_insecure_port("127.0.0.1:0")
        cls.review_server.start()

        cls.movie_server = grpc.server(futures.ThreadPoolExecutor(max_workers=5))
        m_pb2_grpc.add_MovieServiceServicer_to_server(MovieServiceServicer(), cls.movie_server)
        movie_port = cls.movie_server.add_insecure_port("127.0.0.1:0")
        cls.movie_server.start()

        os.environ["USER_SERVICE_PORT"] = str(user_port)
        os.environ["REVIEW_SERVICE_PORT"] = str(review_port)
        os.environ["MOVIE_SERVICE_PORT"] = str(movie_port)
        os.environ["API_PORT"] = "8000"
        # Reset gRPC manager instance to use the dynamic test ports
        GatewayGRPCManager._instance = None

        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        if cls.user_server:
            cls.user_server.stop(0)
        if cls.movie_server:
            cls.movie_server.stop(0)
        if cls.review_server:
            cls.review_server.stop(0)

    def setUp(self):
        user_database.init_db()
        database.init_db()
        user_database.clear_db()
        database.clear_db()
        self.client = TestClient(app)

    def tearDown(self):
        user_database.clear_db()
        database.clear_db()

    # ----------------- Root & Health ----------------- #
    def test_root_endpoint(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "online")
        self.assertIn("docs_url", data)
        self.assertIn("gateway", data)

    def test_auth_register_and_login_success(self):
        reg_payload = {"username": "marcodev", "password": "password123"}
        reg_res = self.client.post("/auth/register", json=reg_payload)
        self.assertEqual(reg_res.status_code, 201)
        reg_data = reg_res.json()
        self.assertIn("access_token", reg_data)
        self.assertEqual(reg_data["username"], "marcodev")
        self.assertEqual(reg_data["token_type"], "bearer")

        login_payload = {"username": "marcodev", "password": "password123"}
        login_res = self.client.post("/auth/login", json=login_payload)
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.json()
        self.assertIn("access_token", login_data)
        self.assertEqual(login_data["username"], "marcodev")

        token = login_data["access_token"]
        me_res = self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.json()["username"], "marcodev")

    def test_auth_register_duplicate_username_400(self):
        payload = {"username": "duplicado", "password": "password123"}
        res1 = self.client.post("/auth/register", json=payload)
        self.assertEqual(res1.status_code, 201)

        res2 = self.client.post("/auth/register", json=payload)
        self.assertEqual(res2.status_code, 400)
        self.assertIn("já existe", res2.json()["detail"])

    def test_auth_login_invalid_password_401(self):
        self.client.post("/auth/register", json={"username": "user1", "password": "correct_password"})
        res = self.client.post("/auth/login", json={"username": "user1", "password": "wrong_password"})
        self.assertEqual(res.status_code, 401)
        self.assertIn("Senha incorreta", res.json()["detail"])

    def test_auth_me_unauthorized_without_token_401(self):
        res = self.client.get("/auth/me")
        self.assertEqual(res.status_code, 401)
        self.assertIn("Token de autenticação ausente", res.json()["detail"])

    def test_auth_me_unauthorized_with_invalid_token_401(self):
        res = self.client.get("/auth/me", headers={"Authorization": "Bearer token_falso_invalido"})
        self.assertEqual(res.status_code, 401)

    def test_create_review_unauthorized_without_jwt_401(self):
        payload = {
            "tmdb_id": 550,
            "rating": 4.5,
            "comment": "Tentando sem token",
        }
        res = self.client.post("/reviews", json=payload)
        self.assertEqual(res.status_code, 401)
        self.assertIn("Token de autenticação ausente", res.json()["detail"])

    def test_create_review_success_201_with_jwt(self):
        reg = self.client.post("/auth/register", json={"username": "critico_mestre", "password": "senha_segura"})
        reg_data = reg.json()
        expected_user_id = reg_data["user_id"]
        token = reg_data["access_token"]

        payload = {
            "tmdb_id": 550,
            "rating": 4.5,
            "comment": "Filme clássico e excelente!",
            "contains_spoilers": False,
        }
        res = self.client.post("/reviews", json=payload, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["tmdb_id"], 550)
        self.assertEqual(data["user_id"], expected_user_id)
        self.assertEqual(data["username"], "critico_mestre")
        self.assertEqual(data["rating"], 4.5)
        self.assertEqual(data["comment"], "Filme clássico e excelente!")
        self.assertFalse(data["contains_spoilers"])
        self.assertTrue(len(data["review_id"]) > 0)

        # Verificar persistência no banco real
        db_reviews = database.get_all_reviews()
        self.assertEqual(len(db_reviews), 1)
        self.assertEqual(db_reviews[0]["review_id"], data["review_id"])
        self.assertEqual(db_reviews[0]["user_id"], expected_user_id)
        self.assertEqual(db_reviews[0]["username"], "critico_mestre")

    def test_create_review_duplicate_forbidden_400(self):
        reg = self.client.post("/auth/register", json={"username": "user_duplicate_rev", "password": "password123"})
        token = reg.json()["access_token"]

        payload = {
            "tmdb_id": 550,
            "rating": 4.0,
            "comment": "Primeira avaliação válida",
        }
        res1 = self.client.post("/reviews", json=payload, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res1.status_code, 201)

        # Segunda avaliação do mesmo usuário para o mesmo filme deve retornar 400 Bad Request
        res2 = self.client.post("/reviews", json=payload, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res2.status_code, 400)
        data2 = res2.json()
        self.assertIn("já avaliou este filme", data2.get("detail", ""))

    def test_create_review_invalid_rating_400(self):
        reg = self.client.post("/auth/register", json={"username": "user_rating_err", "password": "password123"})
        token = reg.json()["access_token"]

        payload = {
            "tmdb_id": 550,
            "rating": 6.0,
            "comment": "Nota fora do range",
        }
        res = self.client.post("/reviews", json=payload, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertEqual(data.get("mensagem"), "Dados inválidos")
        erros = {e["campo"]: e["mensagem"] for e in data.get("erros", [])}
        self.assertIn("rating", erros)
        self.assertIn("0.5 e 5.0", erros["rating"])

    def test_create_review_non_step_rating_400(self):
        reg = self.client.post("/auth/register", json={"username": "user_step_err", "password": "password123"})
        token = reg.json()["access_token"]

        for invalid_rating in [0.6, 1.2, 2.3, 3.7, 4.9]:
            payload = {
                "tmdb_id": 550,
                "rating": invalid_rating,
                "comment": "Nota fracionada incorreta",
            }
            res = self.client.post("/reviews", json=payload, headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(res.status_code, 400)
            data = res.json()
            erros = {e["campo"]: e["mensagem"] for e in data.get("erros", [])}
            self.assertIn("rating", erros)
            self.assertIn("intervalos de 0.5", erros["rating"])

    def test_create_review_invalid_tmdb_id_400(self):
        reg = self.client.post("/auth/register", json={"username": "user_tmdb_err", "password": "password123"})
        token = reg.json()["access_token"]

        payload = {
            "tmdb_id": 0,
            "rating": 4.0,
        }
        res = self.client.post("/reviews", json=payload, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertEqual(data.get("mensagem"), "Dados inválidos")
        erros = {e["campo"]: e["mensagem"] for e in data.get("erros", [])}
        self.assertIn("tmdb_id", erros)
        self.assertIn("positivo maior que zero", erros["tmdb_id"])

    def test_create_review_missing_fields_400(self):
        reg = self.client.post("/auth/register", json={"username": "user_missing", "password": "password123"})
        token = reg.json()["access_token"]

        res = self.client.post("/reviews", json={}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertEqual(data.get("mensagem"), "Dados inválidos")
        campos_com_erro = [e["campo"] for e in data.get("erros", [])]
        self.assertIn("tmdb_id", campos_com_erro)
        self.assertIn("rating", campos_com_erro)

    # ----------------- Reviews List (via gRPC ReviewService) ----------------- #
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

    def test_get_my_reviews_200(self):
        reg = self.client.post("/auth/register", json={"username": "me_user", "password": "password123"})
        token = reg.json()["access_token"]
        uid = reg.json()["user_id"]

        database.add_review(
            550,
            uid,
            4.5,
            "Minha review",
            False,
            movie_title="Clube da Luta",
            poster_url="https://img.com/550.jpg",
            username="me_user",
        )
        database.add_review(
            680,
            "other",
            3.0,
            "Outra",
            False,
            movie_title="Pulp Fiction",
            poster_url="https://img.com/680.jpg",
            username="other",
        )

        res = self.client.get("/reviews/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 200)
        reviews = res.json()
        self.assertEqual(len(reviews), 1)
        self.assertEqual(reviews[0]["tmdb_id"], 550)

    def test_delete_review_endpoints(self):
        reg = self.client.post("/auth/register", json={"username": "author_user", "password": "password123"})
        token = reg.json()["access_token"]
        uid = reg.json()["user_id"]

        reg_intruder = self.client.post("/auth/register", json={"username": "intruder_user", "password": "password123"})
        intruder_token = reg_intruder.json()["access_token"]

        add_res = database.add_review(550, uid, 5.0, "Ótimo!", False, username="author_user")
        rev_id = add_res["review_id"]

        # Sem token -> 401
        res_no_auth = self.client.delete(f"/reviews/{rev_id}")
        self.assertEqual(res_no_auth.status_code, 401)

        # Token de outro usuário -> 403
        res_intruder = self.client.delete(f"/reviews/{rev_id}", headers={"Authorization": f"Bearer {intruder_token}"})
        self.assertEqual(res_intruder.status_code, 403)

        # ID inexistente -> 404
        res_404 = self.client.delete("/reviews/nonexistent-id", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_404.status_code, 404)

        # Autor deletando -> 200
        res_ok = self.client.delete(f"/reviews/{rev_id}", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_ok.status_code, 200)
        self.assertTrue(res_ok.json()["success"])

        # Verificar que sumiu de /reviews/me
        my_revs = self.client.get("/reviews/me", headers={"Authorization": f"Bearer {token}"}).json()
        self.assertEqual(len(my_revs), 0)

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

    def test_get_trending_movies_200(self):
        response = self.client.get("/movies/trending")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("movies", data)
        self.assertIsInstance(data["movies"], list)

    def test_get_trending_tv_200(self):
        response = self.client.get("/movies/trending-tv")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("movies", data)
        self.assertIsInstance(data["movies"], list)

    def test_get_now_playing_movies_200(self):
        response = self.client.get("/movies/now-playing")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("movies", data)
        self.assertIsInstance(data["movies"], list)

    def test_get_recommendations_for_user_endpoint_200(self):
        response = self.client.get("/movies/recommendations?user_id=alice")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("movies", data)

    def test_get_season_episodes_endpoint_200(self):
        from unittest.mock import patch

        with patch("services.tmdb.catalog.get_season_episodes") as mock_season:
            mock_season.return_value = {"season_number": 1, "episodes": [{"episode_number": 1, "name": "Episódio 1"}]}
            res = self.client.get("/movies/1396/season/1")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertIn("episodes", data)

    def test_get_reviews_by_movie_endpoint_200(self):
        database.add_review(tmdb_id=888, user_id="rev_user", rating=4.0, comment="Ótimo")
        res = self.client.get("/reviews/movie/888")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["user_id"], "rev_user")

    def test_get_reviews_by_user_endpoint_200(self):
        database.add_review(tmdb_id=889, user_id="unique_user_rev", rating=5.0, comment="Sensacional")
        res = self.client.get("/reviews/user/unique_user_rev")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["user_id"], "unique_user_rev")

    def test_get_movie_details_200(self):
        response = self.client.get("/movies/550?type=movie")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("tmdb_id"), 550)
        self.assertIn("title", data)
        self.assertIn("genres", data)
        self.assertIn("cast", data)

    def test_get_movie_details_not_found_404(self):
        response = self.client.get("/movies/999999999?type=movie")
        self.assertEqual(response.status_code, 404)

    def test_get_movie_details_out_of_range_id_400(self):
        # Quando o ID fornecido ultrapassa a capacidade de um int32 do protobuf
        response = self.client.get("/movies/5815123123131231321?type=movie")
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data.get("mensagem"), "Dados inválidos")
        campos_com_erro = [e["campo"] for e in data.get("erros", [])]
        self.assertIn("tmdb_id", campos_com_erro)

    def test_create_review_series_episode_201(self):
        reg = self.client.post("/auth/register", json={"username": "tv_fan", "password": "password123"})
        token = reg.json()["access_token"]

        payload = {
            "tmdb_id": 1396,
            "rating": 5.0,
            "comment": "O piloto de Breaking Bad é genial!",
            "contains_spoilers": False,
            "media_type": "tv",
            "season_number": 1,
            "episode_number": 1,
        }
        res = self.client.post("/reviews", json=payload, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["media_type"], "tv")
        self.assertEqual(data["season_number"], 1)
        self.assertEqual(data["episode_number"], 1)

    def test_create_review_unreleased_blocked_400(self):
        from unittest.mock import patch

        reg = self.client.post("/auth/register", json={"username": "time_traveler", "password": "password123"})
        token = reg.json()["access_token"]

        with patch(
            "services.tmdb.get_movie_details",
            return_value={"release_date": "2099-01-01", "title": "Avatar 10"},
        ):
            payload = {
                "tmdb_id": 999999,
                "rating": 5.0,
                "comment": "Vi no futuro!",
            }
            res = self.client.post("/reviews", json=payload, headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(res.status_code, 400)
            self.assertIn("não estreou", res.json()["detail"].lower())

    def test_get_all_series_episodes_200(self):
        from unittest.mock import patch

        mock_data = {
            "1": [{"episode_number": 1, "name": "Pilot"}],
            "2": [{"episode_number": 1, "name": "Seven Thirty-Seven"}],
        }
        with patch("services.tmdb.get_all_series_episodes", return_value=mock_data):
            res = self.client.get("/movies/1396/episodes")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertIn("1", data)
            self.assertEqual(data["1"][0]["name"], "Pilot")
            self.assertIn("2", data)
            self.assertEqual(data["2"][0]["name"], "Seven Thirty-Seven")

    def test_create_review_with_movie_title_persisted_201(self):
        reg = self.client.post("/auth/register", json={"username": "cinephile", "password": "password123"})
        token = reg.json()["access_token"]

        payload = {
            "tmdb_id": 157336,
            "movie_title": "Interstellar",
            "rating": 5.0,
            "comment": "Obra de arte!",
            "contains_spoilers": False,
        }
        res = self.client.post("/reviews", json=payload, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIn(data.get("movie_title"), ["Interestelar", "Interstellar"])

        list_res = self.client.get("/reviews")
        self.assertEqual(list_res.status_code, 200)
        items = list_res.json()
        interstellar_review = next((r for r in items if r["tmdb_id"] == 157336), None)
        self.assertIsNotNone(interstellar_review)
        self.assertIn(interstellar_review["movie_title"], ["Interestelar", "Interstellar"])

    def test_create_review_overwrites_fake_metadata_with_tmdb(self):
        reg = self.client.post("/auth/register", json={"username": "antihacker", "password": "password123"})
        token = reg.json()["access_token"]

        payload = {
            "tmdb_id": 550,
            "movie_title": "Nome Falso Arbitrario",
            "poster_url": "http://malicious.com/fake.jpg",
            "media_type": "fake_type",
            "rating": 4.5,
            "comment": "Tentando forjar metadados",
        }
        res = self.client.post("/reviews", json=payload, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res.status_code, 201)
        data = res.json()
        # Deve ter sido sobrescrito pelo título real do TMDb
        self.assertIn("Clube da Luta", data.get("movie_title", "") or "Fight Club")
        self.assertNotEqual(data.get("movie_title"), "Nome Falso Arbitrario")
        self.assertNotEqual(data.get("poster_url"), "http://malicious.com/fake.jpg")
        self.assertEqual(data.get("media_type"), "movie")

    def test_get_batch_movie_stats_grpc(self):
        database.add_review(550, "u1", 4.0, "", False)
        database.add_review(550, "u2", 5.0, "", False)
        database.add_review(680, "u3", 3.0, "", False)

        from generated import review_pb2 as r_pb2

        servicer = ReviewServiceServicer()
        req = r_pb2.BatchMovieStatsRequest(tmdb_ids=[550, 680, 99999])
        res = servicer.GetBatchMovieStats(req, None)
        self.assertIn(550, res.stats)
        self.assertEqual(res.stats[550].total_count, 2)
        self.assertEqual(res.stats[550].average_rating, 4.5)
        self.assertIn(680, res.stats)
        self.assertEqual(res.stats[680].total_count, 1)
        self.assertEqual(res.stats[680].average_rating, 3.0)
        self.assertIn(99999, res.stats)
        self.assertEqual(res.stats[99999].total_count, 0)
        self.assertEqual(res.stats[99999].average_rating, 0.0)

    def test_schema_user_register_validations(self):
        res = self.client.post("/auth/register", json={"username": "   ", "password": "validpassword"})
        self.assertEqual(res.status_code, 400)

        res_short = self.client.post("/auth/register", json={"username": "ab", "password": "validpassword"})
        self.assertEqual(res_short.status_code, 400)

        res_pw = self.client.post("/auth/register", json={"username": "validuser", "password": "123"})
        self.assertEqual(res_pw.status_code, 400)

    def test_schema_user_login_validations(self):
        res = self.client.post("/auth/login", json={"username": "   ", "password": "validpassword"})
        self.assertEqual(res.status_code, 400)

        res_pw = self.client.post("/auth/login", json={"username": "validuser", "password": "   "})
        self.assertEqual(res_pw.status_code, 400)

    def test_schema_review_create_validations(self):
        reg = self.client.post("/auth/register", json={"username": "schema_validator", "password": "password123"})
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res_low = self.client.post("/reviews", headers=headers, json={"tmdb_id": 550, "rating": 0.2, "comment": "Low"})
        self.assertEqual(res_low.status_code, 400)

        res_high = self.client.post(
            "/reviews", headers=headers, json={"tmdb_id": 550, "rating": 5.5, "comment": "High"}
        )
        self.assertEqual(res_high.status_code, 400)

        long_comment = "x" * 1001
        res_long = self.client.post(
            "/reviews", headers=headers, json={"tmdb_id": 550, "rating": 4.0, "comment": long_comment}
        )
        self.assertEqual(res_long.status_code, 400)

    def test_gateway_root_and_ui_endpoints(self):
        res_json = self.client.get("/", headers={"accept": "application/json"})
        self.assertEqual(res_json.status_code, 200)
        self.assertEqual(res_json.json()["status"], "online")

        res_html = self.client.get("/", headers={"accept": "text/html"})
        self.assertEqual(res_html.status_code, 200)

        res_app = self.client.get("/app")
        self.assertIn(res_app.status_code, (200, 404))

        res_spa = self.client.get("/explorar", headers={"accept": "text/html"})
        self.assertIn(res_spa.status_code, (200, 404))

        res_missing = self.client.get("/static/missing_asset.png", headers={"accept": "*/*"})
        self.assertEqual(res_missing.status_code, 404)

    def test_main_start_function_mock(self):
        from unittest.mock import patch

        from gateway.main import start

        with patch("uvicorn.run") as mock_uvicorn:
            start()
            self.assertTrue(mock_uvicorn.called)

    def test_grpc_manager_singleton(self):
        from gateway.grpc_clients import get_grpc_manager

        mgr = get_grpc_manager()
        self.assertIs(mgr, GatewayGRPCManager.get_instance())


class TestExceptionHandlers(unittest.TestCase):
    def test_grpc_exception_handler_status_mapping(self):
        import asyncio
        from unittest.mock import MagicMock

        from fastapi import Request

        from gateway.exception_handlers import grpc_exception_handler

        class FakeRpcError(grpc.RpcError):
            def __init__(self, code, details):
                self._code = code
                self._details = details

            def code(self):
                return self._code

            def details(self):
                return self._details

        codes_and_expectations = [
            (grpc.StatusCode.NOT_FOUND, 404),
            (grpc.StatusCode.INVALID_ARGUMENT, 400),
            (grpc.StatusCode.ALREADY_EXISTS, 409),
            (grpc.StatusCode.UNAUTHENTICATED, 401),
            (grpc.StatusCode.PERMISSION_DENIED, 403),
            (grpc.StatusCode.UNAVAILABLE, 503),
            (grpc.StatusCode.DEADLINE_EXCEEDED, 504),
            (grpc.StatusCode.INTERNAL, 503),
        ]
        for grpc_code, expected_http in codes_and_expectations:
            exc = FakeRpcError(grpc_code, "Detail error")
            resp = asyncio.run(grpc_exception_handler(MagicMock(spec=Request), exc))
            self.assertEqual(resp.status_code, expected_http)

    def test_value_error_handler_out_of_range(self):
        import asyncio
        import json
        from unittest.mock import MagicMock

        from fastapi import Request

        from gateway.exception_handlers import value_error_handler

        exc = ValueError("Value out of range: 5815123123131231321")
        req = MagicMock(spec=Request)
        req.url.path = "/movies/5815123123131231321"
        resp = asyncio.run(value_error_handler(req, exc))
        self.assertEqual(resp.status_code, 400)
        body = json.loads(resp.body.decode())
        self.assertEqual(body.get("mensagem"), "Dados inválidos")
        self.assertEqual(body["erros"][0]["mensagem"], "Valor numérico fora dos limites permitidos.")


if __name__ == "__main__":
    unittest.main()
