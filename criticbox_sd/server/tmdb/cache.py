import threading
import time
from typing import Any

_CACHE_LOCK = threading.Lock()
_CACHE: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 600.0
MAX_CACHE_SIZE = 1000


def _get_from_cache(key: str) -> Any | None:
    with _CACHE_LOCK:
        if key in _CACHE:
            ts, val = _CACHE[key]
            if time.time() - ts < CACHE_TTL:
                return val
            del _CACHE[key]
    return None


def _set_cache(key: str, val: Any) -> None:
    with _CACHE_LOCK:
        if len(_CACHE) >= MAX_CACHE_SIZE:
            now = time.time()
            expired = [k for k, (ts, _) in _CACHE.items() if now - ts >= CACHE_TTL]
            for k in expired:
                del _CACHE[k]
            if len(_CACHE) >= MAX_CACHE_SIZE:
                # Remove os 20% mais antigos
                oldest_keys = sorted(_CACHE.keys(), key=lambda k: _CACHE[k][0])[: int(MAX_CACHE_SIZE * 0.2)]
                for k in oldest_keys:
                    _CACHE.pop(k, None)
        _CACHE[key] = (time.time(), val)


def clear_cache() -> None:
    with _CACHE_LOCK:
        _CACHE.clear()
