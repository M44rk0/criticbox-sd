from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

class ReviewCreateRequest(BaseModel):
    tmdb_id: int = Field(
        ...,
        gt=0,
        description="ID do filme no TMDb (deve ser um número positivo)",
        json_schema_extra={"example": 550},
    )
    user_id: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Identificador do usuário que fez a avaliação",
        json_schema_extra={"example": "marcodev"},
    )
    rating: float = Field(
        ...,
        ge=0.5,
        le=5.0,
        description="Nota atribuída de 0.5 a 5.0 estrelas",
        json_schema_extra={"example": 4.5},
    )
    comment: Optional[str] = Field(
        default="",
        max_length=1000,
        description="Comentário ou crítica textual sobre a obra",
        json_schema_extra={"example": "Clube da Luta é uma obra-prima do cinema contemporâneo."},
    )
    contains_spoilers: bool = Field(
        default=False,
        description="Sinaliza se a crítica contém spoilers",
        json_schema_extra={"example": False},
    )

    @field_validator("user_id")
    @classmethod
    def validate_user_id(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("não deve estar em branco")
        return stripped

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, v: Optional[str]) -> str:
        return (v or "").strip()


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    review_id: str = Field(..., description="UUID identificador único da avaliação")
    tmdb_id: int = Field(..., description="ID do filme avaliado no TMDb")
    user_id: str = Field(..., description="Usuário que publicou a avaliação")
    rating: float = Field(..., description="Nota concedida (0.5 a 5.0)")
    comment: str = Field(default="", description="Comentário da avaliação")
    contains_spoilers: bool = Field(default=False, description="Flag de spoiler")
    created_at: str = Field(..., description="Data e hora de registro em UTC")
    success: bool = Field(default=True, description="Indicação de sucesso da operação")
    message: str = Field(default="Review registrada com sucesso!", description="Mensagem de retorno")


class ValidationErrorItem(BaseModel):
    campo: str = Field(..., description="Nome do campo com erro")
    mensagem: str = Field(..., description="Descrição do erro de validação")


class ValidationErrorResponse(BaseModel):
    mensagem: str = Field(default="Dados inválidos", description="Mensagem geral de erro")
    erros: list[ValidationErrorItem] = Field(..., description="Lista de erros encontrados nos campos")
