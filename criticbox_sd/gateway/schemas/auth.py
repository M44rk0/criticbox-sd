from pydantic import BaseModel, Field, field_validator


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
