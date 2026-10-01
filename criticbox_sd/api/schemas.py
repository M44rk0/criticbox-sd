from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ----------------- User & Auth Schemas ----------------- #
class UserRegisterRequest(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="Nome de usuário para cadastro (3 a 50 caracteres)",
        json_schema_extra={"example": "marcodev"},
    )
    password: str = Field(
        ...,
        min_length=6,
        max_length=100,
        description="Senha segura (mínimo de 6 caracteres)",
        json_schema_extra={"example": "segredo123"},
    )

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("O nome de usuário não pode estar em branco.")
        if len(s) < 3:
            raise ValueError("O nome de usuário deve ter no mínimo 3 caracteres.")
        return s

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("A senha deve conter no mínimo 6 caracteres.")
        return v


class UserLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, description="Nome de usuário", json_schema_extra={"example": "marcodev"})
    password: str = Field(..., min_length=1, description="Senha", json_schema_extra={"example": "segredo123"})

    @field_validator("username", "password")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Campo obrigatório e não informado.")
        return v.strip()


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    message: str = "Autenticação realizada com sucesso!"


class UserProfileResponse(BaseModel):
    user_id: str
    username: str


# ----------------- Review Schemas ----------------- #
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
    # user_id opcional no payload porque pode vir direto do JWT autenticado!
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
    movie_title: Optional[str] = Field(
        default="",
        description="Título da obra avaliada",
        json_schema_extra={"example": "Interestelar"},
    )
    poster_url: Optional[str] = Field(
        default="",
        description="URL do poster da obra avaliada",
        json_schema_extra={"example": "https://image.tmdb.org/t/p/w500/..."},
    )

    @field_validator("tmdb_id")
    @classmethod
    def validate_tmdb_id(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("O ID do filme deve ser um número inteiro positivo maior que zero.")
        return v

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float) -> float:
        if v < 0.5 or v > 5.0:
            raise ValueError("A nota deve estar entre 0.5 e 5.0 estrelas.")
        return round(float(v), 1)

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, v: Optional[str]) -> str:
        text = (v or "").strip()
        if len(text) > 1000:
            raise ValueError("O comentário deve ter no máximo 1000 caracteres.")
        return text


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    review_id: str
    tmdb_id: int
    movie_title: str = ""
    user_id: str
    rating: float
    comment: str = ""
    contains_spoilers: bool = False
    created_at: str
    media_type: str = "movie"
    season_number: Optional[int] = None
    episode_number: Optional[int] = None
    poster_url: str = ""
    success: bool = True
    message: str = "Review registrada com sucesso!"


class ReviewListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    review_id: str
    tmdb_id: int
    movie_title: str = ""
    user_id: str
    rating: float
    comment: str = ""
    contains_spoilers: bool = False
    created_at: str
    media_type: str = "movie"
    season_number: Optional[int] = None
    episode_number: Optional[int] = None
    poster_url: str = ""


# ----------------- Movie Schemas ----------------- #
class MovieSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tmdb_id: int
    title: str
    release_date: str = ""
    poster_url: str = ""
    backdrop_url: str = ""
    overview: str = ""
    tmdb_vote_average: float = 0.0
    criticbox_rating: float = 0.0
    criticbox_review_count: int = 0
    media_type: str = "movie"


class SearchMoviesResponse(BaseModel):
    page: int = 1
    total_results: int = 0
    total_pages: int = 1
    movies: list[MovieSummary] = []


class CastMember(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    character: str = ""
    profile_url: str = ""


class SeasonInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    season_number: int
    name: str = ""
    episode_count: int = 0
    poster_url: str = ""


class NetworkInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    logo_url: str = ""


class ProviderItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    provider_name: str
    logo_url: str = ""


class WatchProviders(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    flatrate: list[ProviderItem] = []
    rent: list[ProviderItem] = []
    buy: list[ProviderItem] = []


class EpisodeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    episode_number: int = 0
    season_number: int = 0
    name: str = ""
    air_date: str = ""
    overview: str = ""
    still_url: str = ""
    vote_average: float = 0.0


class MovieDetailsResponse(MovieSummary):
    genres: list[str] = []
    runtime: int = 0
    directors: list[str] = []
    cast: list[CastMember] = []
    trailer_url: str = ""
    tagline: str = ""
    number_of_seasons: int = 0
    number_of_episodes: int = 0
    seasons: list[SeasonInfo] = []

    # Novos campos TMDB
    original_title: str = ""
    original_language: str = ""
    spoken_languages: list[str] = []
    certification: str = ""
    vote_count: int = 0
    popularity: float = 0.0
    budget: int = 0
    revenue: int = 0
    status: str = ""
    imdb_id: str = ""
    homepage: str = ""
    logo_url: str = ""
    photos: list[str] = []
    writers: list[str] = []
    music_composers: list[str] = []
    cinematographers: list[str] = []
    producers: list[str] = []

    networks: list[NetworkInfo] = []
    watch_providers: Optional[WatchProviders] = None
    recommendations: list[MovieSummary] = []
    last_episode_to_air: Optional[EpisodeSummary] = None
    next_episode_to_air: Optional[EpisodeSummary] = None
    first_air_date: str = ""
    last_air_date: str = ""


# ----------------- Error Schemas ----------------- #
class ValidationErrorItem(BaseModel):
    campo: str
    mensagem: str


class ValidationErrorResponse(BaseModel):
    mensagem: str = "Dados inválidos"
    erros: list[ValidationErrorItem]
