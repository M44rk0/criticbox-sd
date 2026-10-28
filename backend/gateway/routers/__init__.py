from gateway.routers.activity import router as activity_router
from gateway.routers.auth import router as auth_router
from gateway.routers.movies import router as movies_router
from gateway.routers.reviews import router as reviews_router
from gateway.routers.social import router as social_router

__all__ = ["auth_router", "movies_router", "reviews_router", "activity_router", "social_router"]


