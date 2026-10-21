from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReviewCreateRequest(BaseModel):
    tmdb_id: int = Field(
        ...,
        description="ID do filme no TMDb",
        json_schema_extra={"example": 550},
    )
    rating: float = Field(
        ...,
        description="Nota atribuída de 0.5 a 5.0 estrelas",
        json_schema_extra={"example": 4.5},
    )
    comment: Optional[str] = Field(
        default="",
        description="Comentário ou crítica textual sobre o filme",
        json_schema_extra={"example": "Clube da Luta é uma obra-prima do cinema contemporâneo."},
    )
    contains_spoilers: bool = Field(
        default=False,
        description="Sinaliza se a crítica contém spoilers",
        json_schema_extra={"example": False},
    )
    user_id: Optional[str] = Field(
        default=None,
        description="Identificador opcional (preenchido automaticamente via JWT)",
        json_schema_extra={"example": "marcodev"},
    )
    media_type: Optional[str] = Field(
        default="movie",
        description="Tipo de mídia: 'movie' ou 'tv'",
        json_schema_extra={"example": "movie"},
    )
    season_number: Optional[int] = Field(
        default=None,
        description="Número da temporada avaliada (para séries)",
        json_schema_extra={"example": 1},
    )
    episode_number: Optional[int] = Field(
        default=None,
        description="Número do episódio avaliado (para séries)",
        json_schema_extra={"example": 3},
    )
    model_config = ConfigDict(extra="ignore")

    @field_validator("tmdb_id")
    @classmethod
    def validate_tmdb_id(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("O ID do filme deve ser um número inteiro positivo maior que zero.")
        if v > 2_147_483_647:
            raise ValueError("O ID do filme deve ser no máximo 2147483647.")
        return v

    @field_validator("season_number", "episode_number")
    @classmethod
    def validate_season_episode(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v <= 0 or v > 2_147_483_647):
            raise ValueError("Deve ser um número inteiro positivo válido.")
        return v

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float) -> float:
        rounded = round(float(v), 1)
        valid_steps = {0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0}
        if rounded not in valid_steps or abs(float(v) - rounded) > 1e-4:
            raise ValueError(
                "A nota deve estar entre 0.5 e 5.0 e aumentar em intervalos de 0.5 estrelas (ex: 0.5, 1.0, 1.5, ..., 5.0)."
            )
        return rounded

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, v: Optional[str]) -> str:
        text = (v or "").strip()
        if len(text) > 1000:
            raise ValueError("O comentário deve ter no máximo 1000 caracteres.")
        return text


class ReviewListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    review_id: str
    tmdb_id: int
    movie_title: str = ""
    user_id: str
    username: str = ""
    rating: float
    comment: str = ""
    contains_spoilers: bool = False
    created_at: str
    media_type: str = "movie"
    season_number: Optional[int] = None
    episode_number: Optional[int] = None
    poster_url: str = ""


class ReviewResponse(ReviewListItem):
    success: bool = True
    message: str = "Review registrada com sucesso!"


class ReviewDeleteResponse(BaseModel):
    success: bool = True
    message: str = "Avaliação removida com sucesso."

