from pydantic import BaseModel, Field


class ToggleActivityRequest(BaseModel):
    tmdb_id: int = Field(..., ge=1, le=2_147_483_647, description="ID TMDb da obra")
    media_type: str | None = Field(default="movie", description="Tipo de mídia (movie, tv, anime)")
    movie_title: str | None = Field(default="", description="Título da obra (opcional para evitar consulta remota)")
    poster_url: str | None = Field(default="", description="URL do pôster da obra (opcional)")


class ToggleActivityResponse(BaseModel):
    success: bool
    message: str
    active: bool


class ActivityItemResponse(BaseModel):
    id: str
    tmdb_id: int
    user_id: str
    username: str
    media_type: str = "movie"
    movie_title: str = ""
    poster_url: str = ""
    created_at: str = ""
    user_rating: float | None = None
    has_review: bool = False
    review_id: str = ""


class MediaStatusResponse(BaseModel):
    tmdb_id: int
    media_type: str = "movie"
    is_watched: bool = False
    is_favorite: bool = False
    has_review: bool = False
    user_rating: float | None = None
    review_id: str = ""
