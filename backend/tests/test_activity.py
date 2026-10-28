import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import time
from concurrent import futures

import grpc
from fastapi.testclient import TestClient

from gateway.auth import create_access_token
from gateway.grpc_clients import GatewayGRPCManager
from gateway.main import app
from generated import review_pb2_grpc as r_pb2_grpc
from services.review_service import ReviewServiceServicer
from services.review_service import storage as database


class TestActivityStorage(unittest.TestCase):
    def setUp(self):
        database.init_db()
        database.clear_db()

    def tearDown(self):
        database.clear_db()

    def test_toggle_watched_explicitly(self):
        # 1. Marca como assistido
        res = database.toggle_watched(
            tmdb_id=129,
            user_id="user_123",
            username="marcos",
            media_type="anime",
            movie_title="A Viagem de Chihiro",
            poster_url="https://image.tmdb.org/t/p/w500/chihiro.jpg",
        )
        self.assertTrue(res["success"])
        self.assertTrue(res["active"])

        # 2. Verifica se consta na lista de assistidos
        watched_list = database.get_user_watched(user_id="user_123", username="marcos")
        self.assertEqual(len(watched_list), 1)
        self.assertEqual(watched_list[0]["tmdb_id"], 129)
        self.assertEqual(watched_list[0]["movie_title"], "A Viagem de Chihiro")
        self.assertFalse(watched_list[0]["has_review"])

        # 3. Desmarca como assistido
        res_unmark = database.toggle_watched(
            tmdb_id=129,
            user_id="user_123",
            username="marcos",
            media_type="anime",
        )
        self.assertTrue(res_unmark["success"])
        self.assertFalse(res_unmark["active"])

        # 4. Lista agora vazia
        self.assertEqual(len(database.get_user_watched(user_id="user_123", username="marcos")), 0)

    def test_review_automatically_marks_as_watched(self):
        # Regra de negócio mandatória:
        # "Uma regra que precisa ter é que se um filme tem review, ele é automaticamente assistido"

        # 1. Cria avaliação sem ter marcado explicitamente como assistido antes
        rev = database.add_review(
            tmdb_id=550,
            user_id="user_cine",
            username="cinefilo",
            rating=5.0,
            comment="Filme genial!",
            media_type="movie",
            movie_title="Clube da Luta",
            poster_url="https://image.tmdb.org/p.jpg",
        )
        self.assertTrue(rev["success"])

        # 2. Consulta lista de assistidos: O filme DEVE estar presente com has_review=True e nota
        watched_list = database.get_user_watched(user_id="user_cine", username="cinefilo")
        self.assertEqual(len(watched_list), 1)
        self.assertEqual(watched_list[0]["tmdb_id"], 550)
        self.assertEqual(watched_list[0]["movie_title"], "Clube da Luta")
        self.assertTrue(watched_list[0]["has_review"])
        self.assertEqual(watched_list[0]["user_rating"], 5.0)

        # 3. Tenta desmarcar dos assistidos enquanto a review existe -> DEVE ser barrado
        unmark_attempt = database.toggle_watched(
            tmdb_id=550,
            user_id="user_cine",
            username="cinefilo",
            media_type="movie",
        )
        self.assertFalse(unmark_attempt["success"])
        self.assertTrue(unmark_attempt["active"])
        self.assertIn("avaliação registrada", unmark_attempt["message"].lower())

        # 4. Se a review for excluída, o filme DEVE continuar como assistido (mas sem review)
        del_res = database.delete_review(rev["review_id"], user_id="user_cine", username="cinefilo")
        self.assertTrue(del_res["success"])

        watched_still_present = database.get_user_watched(user_id="user_cine", username="cinefilo")
        self.assertEqual(len(watched_still_present), 1)
        self.assertFalse(watched_still_present[0]["has_review"])
        self.assertEqual(watched_still_present[0]["user_rating"], 0.0)

        # 5. Agora que a review foi apagada, desmarcar manualmente passa a ser permitido
        unmark_after_del = database.toggle_watched(
            tmdb_id=550,
            user_id="user_cine",
            username="cinefilo",
            media_type="movie",
        )
        self.assertTrue(unmark_after_del["success"])
        self.assertFalse(unmark_after_del["active"])
        self.assertEqual(len(database.get_user_watched(user_id="user_cine", username="cinefilo")), 0)

    def test_toggle_favorites(self):
        # 1. Favorita título
        res = database.toggle_favorite(
            tmdb_id=777,
            user_id="user_fav",
            username="fav_lover",
            media_type="movie",
            movie_title="Oppenheimer",
            poster_url="https://example.com/opp.jpg",
        )
        self.assertTrue(res["success"])
        self.assertTrue(res["active"])

        # 2. Lista favoritos
        favs = database.get_user_favorites(user_id="user_fav", username="fav_lover")
        self.assertEqual(len(favs), 1)
        self.assertEqual(favs[0]["tmdb_id"], 777)
        self.assertEqual(favs[0]["movie_title"], "Oppenheimer")

        # 3. Desfavorita
        res_unfav = database.toggle_favorite(
            tmdb_id=777,
            user_id="user_fav",
            username="fav_lover",
            media_type="movie",
        )
        self.assertTrue(res_unfav["success"])
        self.assertFalse(res_unfav["active"])
        self.assertEqual(len(database.get_user_favorites(user_id="user_fav", username="fav_lover")), 0)

    def test_get_media_status(self):
        # Estado inicial (sem interações)
        st0 = database.get_media_status(
            tmdb_id=101,
            user_id="user_status",
            username="status_guy",
            media_type="movie",
        )
        self.assertFalse(st0["is_watched"])
        self.assertFalse(st0["is_favorite"])
        self.assertFalse(st0["has_review"])
        self.assertEqual(st0["user_rating"], 0.0)

        # Marca favorito
        database.toggle_favorite(101, "user_status", "status_guy", "movie", "Filme 101")
        st1 = database.get_media_status(101, "user_status", "status_guy", "movie")
        self.assertFalse(st1["is_watched"])
        self.assertTrue(st1["is_favorite"])

        # Adiciona review (automaticamente vira assistido)
        database.add_review(101, "user_status", 4.5, "Muito bom", False, "movie", username="status_guy")
        st2 = database.get_media_status(101, "user_status", "status_guy", "movie")
        self.assertTrue(st2["is_watched"])
        self.assertTrue(st2["is_favorite"])
        self.assertTrue(st2["has_review"])
        self.assertEqual(st2["user_rating"], 4.5)


class TestActivityAPI(unittest.TestCase):
    review_server = None
    _orig_env = None

    @classmethod
    def setUpClass(cls):
        cls._orig_env = os.environ.get("REVIEW_SERVICE_PORT")
        os.environ["REVIEW_SERVICE_PORT"] = "50066"
        GatewayGRPCManager._instance = None
        cls.review_server = grpc.server(futures.ThreadPoolExecutor(max_workers=5))
        r_pb2_grpc.add_ReviewServiceServicer_to_server(ReviewServiceServicer(), cls.review_server)
        cls.review_server.add_insecure_port("0.0.0.0:50066")
        cls.review_server.start()
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        if cls.review_server:
            cls.review_server.stop(0)
        if cls._orig_env is not None:
            os.environ["REVIEW_SERVICE_PORT"] = cls._orig_env
        else:
            os.environ.pop("REVIEW_SERVICE_PORT", None)
        GatewayGRPCManager._instance = None

    def setUp(self):
        database.init_db()
        database.clear_db()
        self.client = TestClient(app)
        self.token = create_access_token({"sub": "usr_test_api", "username": "testapi_user"})
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        database.clear_db()

    def test_watched_and_favorite_endpoints(self):
        # 1. Toggle watched via API
        res_w = self.client.post(
            "/activity/watched/toggle",
            json={"tmdb_id": 129, "media_type": "anime"},
            headers=self.headers,
        )
        self.assertEqual(res_w.status_code, 200)
        self.assertTrue(res_w.json()["active"])

        # 2. Toggle favorite via API
        res_f = self.client.post(
            "/activity/favorites/toggle",
            json={"tmdb_id": 129, "media_type": "anime"},
            headers=self.headers,
        )
        self.assertEqual(res_f.status_code, 200)
        self.assertTrue(res_f.json()["active"])

        # 3. GET /activity/status/129
        res_st = self.client.get("/activity/status/129?media_type=anime", headers=self.headers)
        self.assertEqual(res_st.status_code, 200)
        st_data = res_st.json()
        self.assertTrue(st_data["is_watched"])
        self.assertTrue(st_data["is_favorite"])
        self.assertFalse(st_data["has_review"])

        # 4. GET /activity/watched
        res_list_w = self.client.get("/activity/watched", headers=self.headers)
        self.assertEqual(res_list_w.status_code, 200)
        self.assertEqual(len(res_list_w.json()), 1)
        self.assertEqual(res_list_w.json()[0]["tmdb_id"], 129)

        # 5. GET /activity/favorites
        res_list_f = self.client.get("/activity/favorites", headers=self.headers)
        self.assertEqual(res_list_f.status_code, 200)
        self.assertEqual(len(res_list_f.json()), 1)
        self.assertEqual(res_list_f.json()[0]["tmdb_id"], 129)

        # 6. GET /activity/user/testapi_user/watched (Público)
        res_pub_w = self.client.get("/activity/user/testapi_user/watched")
        self.assertEqual(res_pub_w.status_code, 200)
        self.assertEqual(len(res_pub_w.json()), 1)

        # 7. GET /activity/user/testapi_user/favorites (Público)
        res_pub_f = self.client.get("/activity/user/testapi_user/favorites")
        self.assertEqual(res_pub_f.status_code, 200)
        self.assertEqual(len(res_pub_f.json()), 1)

    def test_guest_status_endpoint(self):
        res = self.client.get("/activity/status/999?media_type=movie")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data["is_watched"])
        self.assertFalse(data["is_favorite"])
        self.assertFalse(data["has_review"])

    def test_cannot_unmark_watched_if_review_exists(self):
        # 1. Adiciona review no banco
        database.add_review(
            tmdb_id=550,
            user_id="usr_test_api",
            rating=5.0,
            comment="Clube da Luta excelente!",
            contains_spoilers=False,
            media_type="movie",
            username="testapi_user",
        )

        # 2. Confirma que já consta como assistido
        st = self.client.get("/activity/status/550?media_type=movie", headers=self.headers)
        self.assertEqual(st.status_code, 200)
        self.assertTrue(st.json()["is_watched"])
        self.assertTrue(st.json()["has_review"])

        # 3. Tenta desmarcar como assistido -> deve retornar 400
        res = self.client.post(
            "/activity/watched/toggle",
            json={"tmdb_id": 550, "media_type": "movie"},
            headers=self.headers,
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("avaliação", res.json()["detail"].lower())

    def test_toggle_favorite_off(self):
        # Liga favorito
        res_on = self.client.post(
            "/activity/favorites/toggle",
            json={"tmdb_id": 777, "media_type": "movie"},
            headers=self.headers,
        )
        self.assertEqual(res_on.status_code, 200)
        self.assertTrue(res_on.json()["active"])

        # Desliga favorito
        res_off = self.client.post(
            "/activity/favorites/toggle",
            json={"tmdb_id": 777, "media_type": "movie"},
            headers=self.headers,
        )
        self.assertEqual(res_off.status_code, 200)
        self.assertFalse(res_off.json()["active"])

        # Lista de favoritos deve estar vazia
        res_list = self.client.get("/activity/favorites", headers=self.headers)
        self.assertEqual(res_list.status_code, 200)
        self.assertEqual(len(res_list.json()), 0)


if __name__ == "__main__":
    unittest.main()
