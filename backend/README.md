# Criticbox SD — Backend

Microsserviços gRPC e API Gateway (FastAPI) para a plataforma Criticbox.

## Estrutura do Backend

- `gateway/`: API Gateway REST em FastAPI (segurança, JWT, roteamento e validação de schemas).
- `services/user_service/`: Microsserviço de Identidade & Autenticação gRPC (:50053) com banco exclusivo (`users.db` / `criticbox_users`).
- `services/movie_service/`: Microsserviço de Catálogo & Mídia gRPC (:50051), stateless, com integração TMDb e cache em RAM.
- `services/review_service/`: Microsserviço de Avaliações gRPC (:50052) com banco exclusivo (`reviews.db` / `criticbox_reviews`) e desnormalização atômica.
- `services/tmdb/`: Cliente TMDb, cache thread-safe com TTL, extratores e motor de recomendação por afinidade.
- `proto/`: Contratos Protocol Buffers (`user.proto`, `movie.proto`, `review.proto`).
- `generated/`: Stubs gRPC compilados para Python.
- `tests/`: Suíte completa de testes automatizados com pytest (125 testes).
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
