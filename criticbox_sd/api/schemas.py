from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReviewCreateRequest(BaseModel):
    tmdb_id: int = Field(
        ...,
        description="ID do filme no TMDb",
        json_schema_extra={"example": 550},
    )
    user_id: str = Field(
        ...,
        description="Identificador do usuário que fez a avaliação",
        json_schema_extra={"example": "marcodev"},
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

    @field_validator("tmdb_id")
    @classmethod
    def validate_tmdb_id(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("O ID do filme deve ser um número inteiro positivo maior que zero.")
        return v

    @field_validator("user_id")
    @classmethod
    def validate_user_id(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("O nome de usuário não pode estar em branco.")
        if len(stripped) > 50:
            raise ValueError("O nome de usuário deve ter no máximo 50 caracteres.")
        return stripped

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
    user_id: str
    rating: float
    comment: str = ""
    contains_spoilers: bool = False
    created_at: str
    success: bool = True
    message: str = "Review registrada com sucesso!"


class ValidationErrorItem(BaseModel):
    campo: str
    mensagem: str


class ValidationErrorResponse(BaseModel):
    mensagem: str = "Dados inválidos"
    erros: list[ValidationErrorItem]
