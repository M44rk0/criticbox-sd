# Criticbox SD — Backend

Microsserviços gRPC e API Gateway (FastAPI) para a plataforma Criticbox.

## Estrutura do Backend

- `gateway/`: API Gateway REST em FastAPI (segurança, JWT, roteamento e validação de schemas).
- `services/`: Microsserviços internos gRPC (`UserService`, `MovieService`, `ReviewService`).
- `services/storage/`: Camada de persistência desacoplada com SQLAlchemy 2.0 (suporte a SQLite local e Cloud SQL / MySQL).
- `services/tmdb/`: Integração com API externa TMDb, cache thread-safe e sistema de recomendações.
- `proto/`: Contratos Protocol Buffers (`user.proto`, `movie.proto`, `review.proto`).
- `generated/`: Stubs gRPC compilados para Python.
- `tests/`: Suíte completa de testes automatizados com pytest.
- `scripts/`: Utilitários (compilação de protobufs).

## Como Executar

### 1. Instalar dependências
```bash
poetry install
```

### 2. Configurar variáveis de ambiente
Copie `.env.example` para `.env` e preencha a chave do TMDb:
```bash
cp .env.example .env
```

### 3. Iniciar todos os serviços
```bash
poetry run start
```
Isso iniciará concorrentemente:
- `UserService` na porta `50053`
- `MovieService` na porta `50051`
- `ReviewService` na porta `50052`
- `API Gateway` na porta `8000`

### 4. Executar os testes
```bash
poetry run pytest --cov=gateway --cov=services
```
