import os
import sys
import tempfile

import pytest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Configure an isolated temp SQLite db before importing storage
temp_db_fd, temp_db_path = tempfile.mkstemp(prefix="criticbox_test_", suffix=".db")
os.close(temp_db_fd)
os.environ["DATABASE_PATH"] = temp_db_path

from criticbox_sd.services.storage import clear_db, init_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Inicializa banco SQLite isolado para os testes e limpa ao final."""
    init_db()
    clear_db()
    yield
    try:
        if os.path.exists(temp_db_path):
            os.remove(temp_db_path)
    except Exception:
        pass


@pytest.fixture(autouse=True)
def clean_database_between_tests():
    """Garante isolamento de estado entre cada teste individual."""
    yield
    try:
        clear_db()
    except Exception:
        pass
