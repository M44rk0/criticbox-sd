import os
import sys
import tempfile
import time
import unittest
from concurrent import futures
import grpc

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

if not os.environ.get("USER_DATABASE_PATH"):
    _ufd, _upath = tempfile.mkstemp(prefix="criticbox_social_user_test_", suffix=".db")
    os.close(_ufd)
    os.environ["USER_DATABASE_PATH"] = _upath

if not os.environ.get("REVIEW_DATABASE_PATH"):
    _rfd, _rpath = tempfile.mkstemp(prefix="criticbox_social_review_test_", suffix=".db")
    os.close(_rfd)
    os.environ["REVIEW_DATABASE_PATH"] = _rpath

os.environ["API_PORT"] = "8000"

from fastapi.testclient import TestClient
from gateway.grpc_clients import GatewayGRPCManager
from gateway.main import app
from gateway.auth import create_access_token
from generated import movie_pb2_grpc as m_pb2_grpc
from generated import review_pb2_grpc as r_pb2_grpc
from generated import user_pb2_grpc as u_pb2_grpc
from services.movie_service import MovieServiceServicer
from services.review_service import ReviewServiceServicer
from services.review_service import storage as review_storage
from services.user_service import UserServiceServicer
from services.user_service import storage as user_storage


class TestSocialAndDetailedReview(unittest.TestCase):
    user_server = None
    movie_server = None
    review_server = None
    client = None

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
        GatewayGRPCManager._instance = None

        time.sleep(0.3)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        if cls.user_server:
            cls.user_server.stop(0)
        if cls.review_server:
            cls.review_server.stop(0)
        if cls.movie_server:
            cls.movie_server.stop(0)
        GatewayGRPCManager._instance = None

    def setUp(self):
        user_storage.init_db()
        review_storage.init_db()
        user_storage.create_user("cinefilo_alpha", "senha123456")
        user_storage.create_user("cinefilo_beta", "senha123456")
        user_storage.create_user("cinefilo_gamma", "senha123456")

    def test_user_search(self):
        resp = self.client.get("/users/search?q=alpha")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreaterEqual(len(data), 1)
        self.assertTrue(any(u["username"] == "cinefilo_alpha" for u in data))

    def test_follow_and_mutual_amizade(self):
        # Authenticate as alpha
        auth_alpha = user_storage.authenticate_user("cinefilo_alpha", "senha123456")
        token_alpha = create_access_token({"sub": auth_alpha["user_id"], "username": "cinefilo_alpha"})
        headers_alpha = {"Authorization": f"Bearer {token_alpha}"}

        # Authenticate as beta
        auth_beta = user_storage.authenticate_user("cinefilo_beta", "senha123456")
        token_beta = create_access_token({"sub": auth_beta["user_id"], "username": "cinefilo_beta"})
        headers_beta = {"Authorization": f"Bearer {token_beta}"}

        # Alpha follows Beta
        resp1 = self.client.post(f"/users/{auth_beta['user_id']}/follow", headers=headers_alpha)
        self.assertEqual(resp1.status_code, 200)
        self.assertFalse(resp1.json()["is_mutual"])

        # Check Beta's profile from Alpha's perspective
        p_resp = self.client.get("/users/cinefilo_beta/profile", headers=headers_alpha)
        self.assertEqual(p_resp.status_code, 200)
        prof = p_resp.json()
        self.assertGreaterEqual(prof["followers_count"], 1)
        self.assertTrue(prof["is_following"])
        self.assertFalse(prof["is_mutual"])

        # Beta follows Alpha back -> Mutual friendship (Amigos)
        resp2 = self.client.post(f"/users/{auth_alpha['user_id']}/follow", headers=headers_beta)
        self.assertEqual(resp2.status_code, 200)
        self.assertTrue(resp2.json()["is_mutual"])

        # Check Alpha's profile from Beta's perspective
        p_alpha = self.client.get("/users/cinefilo_alpha/profile", headers=headers_beta)
        self.assertEqual(p_alpha.status_code, 200)
        self.assertTrue(p_alpha.json()["is_mutual"])

        # Followers list
        f_resp = self.client.get("/users/cinefilo_beta/followers")
        self.assertEqual(f_resp.status_code, 200)
        self.assertTrue(any(u["username"] == "cinefilo_alpha" for u in f_resp.json()))

    def test_detailed_review_privacy(self):
        auth_user = user_storage.authenticate_user("cinefilo_gamma", "senha123456")
        token = create_access_token({"sub": auth_user["user_id"], "username": "cinefilo_gamma"})
        headers = {"Authorization": f"Bearer {token}"}

        payload = {
            "tmdb_id": 550,
            "rating": 4.5,
            "comment": "Obra-prima cult absoluta.",
            "contains_spoilers": False,
            "media_type": "movie",
            "custom_rating": 9450,
            "watched_with": "@cinefilo_alpha, Gabriel",
            "viewing_venue": "Cinema IMAX",
        }
        create_resp = self.client.post("/reviews", json=payload, headers=headers)
        self.assertEqual(create_resp.status_code, 201)
        created_data = create_resp.json()
        self.assertEqual(created_data["custom_rating"], 9450)
        self.assertEqual(created_data["watched_with"], "@cinefilo_alpha, Gabriel")
        self.assertEqual(created_data["viewing_venue"], "Cinema IMAX")

        # User fetches their own reviews for "Minha Caixa" (/reviews/me) -> Details visible!
        me_resp = self.client.get("/reviews/me", headers=headers)
        self.assertEqual(me_resp.status_code, 200)
        my_reviews = me_resp.json()
        gamma_rev = next((r for r in my_reviews if r["tmdb_id"] == 550), None)
        self.assertIsNotNone(gamma_rev)
        self.assertEqual(gamma_rev["custom_rating"], 9450)
        self.assertEqual(gamma_rev["watched_with"], "@cinefilo_alpha, Gabriel")
        self.assertEqual(gamma_rev["viewing_venue"], "Cinema IMAX")

        # Public endpoint (/reviews/movie/550) -> Detailed fields sanitized/hidden!
        pub_resp = self.client.get("/reviews/movie/550")
        self.assertEqual(pub_resp.status_code, 200)
        pub_reviews = pub_resp.json()
        pub_gamma = next((r for r in pub_reviews if r["username"] == "cinefilo_gamma"), None)
        if pub_gamma:
            self.assertIsNone(pub_gamma["custom_rating"])
            self.assertEqual(pub_gamma["watched_with"], "")
            self.assertEqual(pub_gamma["viewing_venue"], "")
