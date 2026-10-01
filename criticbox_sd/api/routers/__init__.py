from criticbox_sd.api.routers.auth import router as auth_router
from criticbox_sd.api.routers.movies import router as movies_router
from criticbox_sd.api.routers.reviews import router as reviews_router

__all__ = ["auth_router", "movies_router", "reviews_router"]
