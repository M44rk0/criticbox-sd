import os
import sys
import tempfile

import pytest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Configure isolated temp SQLite databases for each microservice
user_fd, user_temp_path = tempfile.mkstemp(prefix="criticbox_user_test_", suffix=".db")
os.close(user_fd)
os.environ["USER_DATABASE_PATH"] = user_temp_path

review_fd, review_temp_path = tempfile.mkstemp(prefix="criticbox_review_test_", suffix=".db")
os.close(review_fd)
os.environ["REVIEW_DATABASE_PATH"] = review_temp_path

from services.review_service import storage as review_storage
from services.user_service import storage as user_storage


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Inicializa bancos SQLite isolados para cada microsserviço nos testes e limpa ao final."""
    user_storage.init_db()
    review_storage.init_db()
    user_storage.clear_db()
    review_storage.clear_db()
    yield
    for path in (user_temp_path, review_temp_path):
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass


@pytest.fixture(autouse=True)
def clean_database_between_tests():
    """Garante isolamento de estado entre cada teste individual limpando ambos os bancos."""
    yield
    try:
        user_storage.clear_db()
        review_storage.clear_db()
    except Exception:
        pass
