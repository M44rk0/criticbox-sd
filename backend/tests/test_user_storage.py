import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from services.user_service.storage import (
    _verify_password,
    authenticate_user,
    clear_db,
    create_user,
    get_connection,
    get_database_url,
    get_engine,
    get_sqlite_path,
    init_db,
    is_mysql,
)


class TestUserStorage(unittest.TestCase):
    def setUp(self):
        init_db()
        clear_db()

    def tearDown(self):
        clear_db()

    def test_create_user_success(self):
        res = create_user("alice", "securepass123")
        self.assertTrue(res["success"])
        self.assertEqual(res["username"], "alice")
        self.assertTrue(len(res["user_id"]) > 0)

    def test_create_user_blank_username_fails(self):
        res = create_user("   ", "securepass123")
        self.assertFalse(res["success"])
        self.assertIn("em branco", res["message"])

    def test_create_user_short_password_fails(self):
        res = create_user("bob", "123")
        self.assertFalse(res["success"])
        self.assertIn("mínimo 6 caracteres", res["message"])

    def test_create_user_duplicate_fails(self):
        create_user("carlos", "password123")
        res = create_user("carlos", "password456")
        self.assertFalse(res["success"])
        self.assertIn("já existe", res["message"])

    def test_authenticate_user_success(self):
        create_user("daniela", "mypassword")
        res = authenticate_user("daniela", "mypassword")
        self.assertTrue(res["success"])
        self.assertEqual(res["username"], "daniela")

    def test_authenticate_user_wrong_password(self):
        create_user("eduardo", "mypassword")
        res = authenticate_user("eduardo", "wrongpass")
        self.assertFalse(res["success"])
        self.assertIn("Senha incorreta", res["message"])

    def test_authenticate_user_not_found(self):
        res = authenticate_user("nonexistent", "anypassword")
        self.assertFalse(res["success"])
        self.assertIn("não encontrado", res["message"])

    def test_verify_password_malformed_hash(self):
        self.assertFalse(_verify_password("pass", "malformed_hash_without_colon"))
        self.assertFalse(_verify_password("pass", "nothex:nothex"))

    def test_user_database_connection(self):
        with get_connection() as conn:
            conn.execute("SELECT 1")

    def test_is_mysql_detection(self):
        self.assertFalse(is_mysql())

        old_dp = os.environ.get("USER_DATABASE_PATH")
        old_legacy_dp = os.environ.get("DATABASE_PATH")
        old_host = os.environ.get("USER_DB_HOST")
        old_type = os.environ.get("DB_TYPE")
        try:
            os.environ.pop("USER_DATABASE_PATH", None)
            os.environ.pop("DATABASE_PATH", None)
            os.environ["USER_DB_HOST"] = "10.0.0.1"
            self.assertTrue(is_mysql())

            os.environ.pop("USER_DB_HOST", None)
            os.environ["DB_TYPE"] = "mysql"
            self.assertTrue(is_mysql())

            os.environ["DB_TYPE"] = "sqlite"
            self.assertFalse(is_mysql())
        finally:
            if old_dp is not None:
                os.environ["USER_DATABASE_PATH"] = old_dp
            else:
                os.environ.pop("USER_DATABASE_PATH", None)
            if old_legacy_dp is not None:
                os.environ["DATABASE_PATH"] = old_legacy_dp
            else:
                os.environ.pop("DATABASE_PATH", None)
            if old_host is not None:
                os.environ["USER_DB_HOST"] = old_host
            else:
                os.environ.pop("USER_DB_HOST", None)
            if old_type is not None:
                os.environ["DB_TYPE"] = old_type
            else:
                os.environ.pop("DB_TYPE", None)

    def test_get_sqlite_path(self):
        old_dp = os.environ.get("USER_DATABASE_PATH")
        try:
            os.environ["USER_DATABASE_PATH"] = "/custom/path/users.sqlite"
            self.assertEqual(get_sqlite_path(), "/custom/path/users.sqlite")

            os.environ.pop("USER_DATABASE_PATH", None)
            old_legacy = os.environ.pop("DATABASE_PATH", None)
            try:
                default_path = get_sqlite_path()
                self.assertTrue(default_path.endswith("users.db"))
            finally:
                if old_legacy is not None:
                    os.environ["DATABASE_PATH"] = old_legacy
        finally:
            if old_dp is not None:
                os.environ["USER_DATABASE_PATH"] = old_dp

    def test_dbclient_mysql_adaptation(self):
        from unittest.mock import MagicMock

        from services.user_service.storage.connection import DBClient

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        client = DBClient(conn=mock_conn, is_mysql_conn=True)
        client.execute("SELECT * FROM users WHERE id = ? AND username = ?", ("u1", "alice"))

        mock_cursor.execute.assert_called_once_with(
            "SELECT * FROM users WHERE id = %s AND username = %s",
            ("u1", "alice"),
        )

    def test_get_connection_mysql_lifecycle(self):
        from unittest.mock import MagicMock, patch

        mock_conn = MagicMock()
        with patch("services.user_service.storage.connection.is_mysql", return_value=True):
            with patch("pymysql.connect", return_value=mock_conn):
                with get_connection() as client:
                    self.assertTrue(client.is_mysql)
                    self.assertEqual(client.conn, mock_conn)
                mock_conn.close.assert_called_once()

    def test_get_connection_exception_rolls_back_and_raises(self):
        with self.assertRaises(RuntimeError):
            with get_connection():
                raise RuntimeError("Falha proposital de banco")

    def test_sqlite_pool_queue_full_cleanup(self):
        import queue
        from unittest.mock import MagicMock

        from services.user_service.storage.connection import _SQLITE_POOL

        dummy_conns = []
        try:
            while not _SQLITE_POOL.full():
                mock_conn = MagicMock()
                dummy_conns.append(mock_conn)
                _SQLITE_POOL.put_nowait(mock_conn)

            with get_connection() as client:
                self.assertIsNotNone(client)
        finally:
            while not _SQLITE_POOL.empty():
                try:
                    _SQLITE_POOL.get_nowait()
                except queue.Empty:
                    break

    def test_get_database_url_and_engine(self):
        from unittest.mock import patch

        sqlite_url = get_database_url()
        self.assertTrue(sqlite_url.startswith("sqlite:///"))

        with patch("services.user_service.storage.connection.is_mysql", return_value=True):
            mysql_url = get_database_url()
            self.assertTrue(mysql_url.startswith("mysql+pymysql://"))

        engine = get_engine()
        self.assertIsNotNone(engine)


if __name__ == "__main__":
    unittest.main()
