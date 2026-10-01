from pydantic import BaseModel


class ValidationErrorItem(BaseModel):
    campo: str
    mensagem: str


class ValidationErrorResponse(BaseModel):
    mensagem: str = "Dados inválidos"
    erros: list[ValidationErrorItem]
