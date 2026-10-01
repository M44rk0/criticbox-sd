import os
import sys
import unittest
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import jwt
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from gateway.auth import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    decode_access_token,
    get_current_user,
)


class TestAuthModule(unittest.TestCase):
    def test_create_and_decode_token_success(self):
        data = {"sub": "user_id_123", "username": "carlos"}
        token = create_access_token(data=data, expires_delta=timedelta(minutes=15))
        payload = decode_access_token(token)
        self.assertEqual(payload["sub"], "user_id_123")
        self.assertEqual(payload["username"], "carlos")

    def test_decode_expired_token_raises_401(self):
        data = {"sub": "user_expired", "username": "olduser"}
        token = create_access_token(data=data, expires_delta=timedelta(seconds=-10))
        with self.assertRaises(HTTPException) as ctx:
            decode_access_token(token)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("expirado", ctx.exception.detail)

    def test_decode_invalid_token_raises_401(self):
        with self.assertRaises(HTTPException) as ctx:
            decode_access_token("completely_invalid_jwt_token")
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("inválido", ctx.exception.detail)

    def test_get_current_user_valid_credentials(self):
        token = create_access_token({"sub": "u_99", "username": "marcelo"})
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        user = get_current_user(credentials=creds)
        self.assertEqual(user["user_id"], "u_99")
        self.assertEqual(user["username"], "marcelo")

    def test_get_current_user_missing_credentials_raises_401(self):
        with self.assertRaises(HTTPException) as ctx:
            get_current_user(credentials=None)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("ausente", ctx.exception.detail)

    def test_get_current_user_invalid_scheme_raises_401(self):
        token = create_access_token({"sub": "u_99", "username": "marcelo"})
        creds = HTTPAuthorizationCredentials(scheme="Basic", credentials=token)
        with self.assertRaises(HTTPException) as ctx:
            get_current_user(credentials=creds)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("ausente ou inválido", ctx.exception.detail)

    def test_get_current_user_missing_sub_or_username_raises_401(self):
        token = jwt.encode({"other": "field"}, SECRET_KEY, algorithm=ALGORITHM)
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with self.assertRaises(HTTPException) as ctx:
            get_current_user(credentials=creds)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("não contém informações de usuário válidas", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
