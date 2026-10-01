# 🎬 Criticbox SD — Arquitetura Distribuída (Entrega 2)

Sistema distribuído de catálogo e avaliação de filmes desenvolvido para a disciplina de **Sistemas Distribuídos (SD)**. A solução implementa um ecossistema com **Frontend Web moderno (React + Vite)**, um **API Gateway centralizador (FastAPI)** com autenticação **JWT**, e **2 Microsserviços internos comunicando-se via gRPC (Protocol Buffers)** com persistência em **Banco de Dados Real (SQLite / MySQL)**.

---

## 🏛️ Visão Geral da Arquitetura Distribuída

```
┌─────────────────────────────────────────────────────────────────┐
│                       Frontend (React / Vite)                   │
│   Interface visual brutalista, autenticação JWT, busca & notas  │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP / JSON (Bearer Token)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│               API Gateway Centralizador (FastAPI :8000)         │
│  - Borda única de entrada                                       │
│  - Middleware de Autenticação JWT (401 se ausente/inválido)     │
│  - Validação de Payloads JSON (400 Bad Request detalhado)       │
│  - Tradução de Protocolos: HTTP/JSON ◄► gRPC/Protobuf binário   │
└──────────────────┬─────────────────────────────┬────────────────┘
                   │ gRPC / Protobuf             │ gRPC / Protobuf
                   │ (Porta 50051)               │ (Porta 50052)
                   ▼                             ▼
┌──────────────────────────────┐ ┌────────────────────────────────┐
│  Microsserviço de Catálogo   │ │  Microsserviço de Avaliações   │
│     (MovieService :50051)    │ │    (ReviewService :50052)      │
│ - Busca de Filmes            │ │ - Registro e Login de Usuários │
│ - Filmes em Alta (Trending)  │ │ - Criação de Críticas (Notas)  │
│ - Detalhes do Filme          │ │ - Cálculo de Médias do Filme   │
│ - Integração com API TMDb    │ │ - Listagem Geral de Reviews    │
└──────────────┬───────────────┘ └───────────────┬────────────────┘
               │                                 │
               └──── Chamada RPC Inter-serviço ──┘
                     (Estatísticas de Reviews)
                                 │
                                 ▼
               ┌───────────────────────────────────┐
               │    Banco de Dados Real (SQLite)   │
               │   Tabelas: users e reviews        │
               │   (Sem mocks ou dados em memória) │
               └───────────────────────────────────┘
```

---

## 📋 Requisitos Atendidos

| Requisito | Implementação no Criticbox |
|---|---|
| **Frontend** | Interface completa em **React** (Vite) no diretório `frontend/`, com tema Dark Brutalista, seletor de estrelas (0.5 a 5.0), busca dinâmica com debounce, modais de autenticação e detalhes completos com trailers e temporadas. Comunica-se **exclusivamente com o API Gateway**. |
| **API Gateway** | Desenvolvido em **FastAPI** (`backend/gateway`), escutando em `http://localhost:8000`. Recebe HTTP/JSON, valida schemas Pydantic, autentica JWT e orquestra chamadas gRPC para os microsserviços internos. |
| **Backend com 3 Microsserviços** | 1) **UserService** (porta 50053), 2) **MovieService** (porta 50051) e 3) **ReviewService** (porta 50052). Todos expõem serviços gRPC definidos via Protocol Buffers. |
| **Comunicação Inter-serviços** | O `MovieService` consulta o `ReviewService` via gRPC (`GetMovieStats`) para agregar a média e o total de avaliações da comunidade às listagens em tempo real. |
| **Banco de Dados Real & ORM** | Persistência unificada com **SQLAlchemy 2.0** (`backend/services/storage`) com suporte híbrido: **SQLite** local com modo WAL e **Cloud SQL / MySQL** em nuvem. |
| **Validação no Gateway** | Schemas Pydantic modulares em `backend/gateway/schemas/`. Retorno padronizado de erros de validação (`400 Bad Request`), conflitos (`409 Conflict`), `201 Created` e `200 OK`. |
| **Segurança (JWT & Bcrypt)** | Hashing criptográfico de senhas com `bcrypt` no `UserService` e emissão/validação de tokens JWT Bearer no Gateway. |
| **Tradução de Protocolo** | O Gateway desserializa JSON, valida na borda, invoca os stubs gRPC via HTTP/2 binário e converte as respostas de volta para JSON para o cliente. |

---

## 🛠️ Tecnologias Utilizadas

- **Linguagem Backend:** Python 3.10+
- **Frontend:** React 19, Vite, CSS Vanilla Moderno
- **API Gateway:** FastAPI, Uvicorn, Pydantic v2
- **Segurança:** PyJWT, Bcrypt (hashing criptográfico de senhas)
- **RPC & Serialização:** gRPC, Protocol Buffers (`proto3`)
- **Banco de Dados:** SQLAlchemy 2.0 (SQLite local com WAL / Cloud SQL MySQL)
- **API Externa de Catálogo:** TMDb API (`tmdbsimple`)
- **Gerenciador de Dependências:** Poetry (backend) e npm (frontend)

---

## 📁 Estrutura de Arquivos (Monorepo)

```text
criticbox-sd/
├── backend/                    # Projeto Python isolado (gRPC + Gateway)
│   ├── gateway/                # API Gateway FastAPI (rotas REST, JWT, validações)
│   │   ├── routers/            # Rotas /auth, /movies, /reviews
│   │   ├── schemas/            # Schemas Pydantic modulares por domínio
│   │   └── exception_handlers.py # Tradução gRPC RpcError -> HTTP status
│   ├── services/               # Microsserviços internos gRPC
│   │   ├── user_service.py     # Microsserviço de Identidade (:50053)
│   │   ├── movie_service.py    # Microsserviço de Catálogo e Mídia (:50051)
│   │   ├── review_service.py   # Microsserviço de Avaliações (:50052)
│   │   ├── storage/            # Camada ORM SQLAlchemy 2.0 e Repositories
│   │   └── tmdb/               # Integração TMDb, cache TTL e recomendações
│   ├── proto/                  # Contratos IDL Protocol Buffers
│   ├── generated/              # Stubs Python gerados pelo protoc
│   ├── tests/                  # Suíte de testes automatizados com pytest (124 testes)
│   ├── scripts/                # Utilitários (compile_proto, backfill_posters)
│   ├── pyproject.toml          # Dependências do Poetry e scripts de inicialização
│   └── run_all.py              # Orquestrador unificado para inicialização concorrente
│
├── frontend/                   # Aplicação Web SPA (React + Vite)
│   ├── src/                    # Componentes, páginas e design system
│   ├── package.json            # Dependências npm
│   └── vite.config.js          # Configuração do Vite e proxies
│
├── ARCHITECTURE.md             # Documento de arquitetura detalhada
├── DESIGN.md                   # Diretrizes visuais e tokens de design
└── README.md
```
```

---

## 🚀 Como Executar

### 1. Pré-requisitos
- Python 3.10+
- Poetry (`pip install poetry`)
- Node.js 18+ e npm

### 2. Instalação das Dependências

```bash
# No diretório do backend (Python):
cd backend
poetry install
cd ..

# No diretório do frontend (React):
cd frontend
npm install
cd ..
```

### 3. Configuração do `.env`

Copie o `.env.example` para `.env` dentro de `backend/`:
```bash
cd backend
cp .env.example .env
cd ..
```
*(Opcional: insira sua chave TMDb em `TMDB_API_KEY`, ou utilize a chave de demonstração já pré-configurada).*

---

### 4. Executando a Aplicação

#### Opção A: Executar Tudo com Comando Único (Recomendado)

O script `run_all.py` inicia simultaneamente os 3 microsserviços gRPC e o API Gateway:

```bash
cd backend
poetry run start
```

Saída no console:
```text
======================================================================
INICIANDO ECOSSISTEMA DISTRIBUÍDO CRITICBOX (ENTREGA 2)
======================================================================
✓ [gRPC] UserService ativo na porta 50053
✓ [gRPC] ReviewService ativo na porta 50052
✓ [gRPC] MovieService ativo na porta 50051
✓ [REST] Iniciando API Gateway em http://0.0.0.0:8000
  -> Interface Web (Frontend): http://localhost:8000/app
  -> Documentação Swagger:   http://localhost:8000/docs
======================================================================
```

Em seguida, em outro terminal, inicie o Frontend React em modo de desenvolvimento:
```bash
cd frontend
npm run dev
```
Acesse a aplicação no navegador em: **`http://localhost:5173`** (ou acesse diretamente pelo Gateway em `http://localhost:8000/app`).

---

#### Opção B: Executar os Serviços Separadamente

Se desejar acompanhar os logs de cada microsserviço em terminais isolados (todos a partir da pasta `backend/`):

1. **Terminal 1 — Microsserviço de Identidade e Usuários (gRPC 50053):**
   ```bash
   cd backend
   poetry run user-service
   ```

2. **Terminal 2 — Microsserviço de Avaliações (gRPC 50052):**
   ```bash
   cd backend
   poetry run review-service
   ```

3. **Terminal 3 — Microsserviço de Filmes e Catálogo (gRPC 50051):**
   ```bash
   cd backend
   poetry run movie-service
   ```

4. **Terminal 4 — API Gateway FastAPI (HTTP 8000):**
   ```bash
   cd backend
   poetry run api
   ```

5. **Terminal 5 — Frontend React:**
   ```bash
   cd frontend
   npm run dev
   ```

---

## 🧪 Testes Automatizados

O projeto conta com uma suíte abrangente de testes unitários e de integração que validam:
- Autenticação e ciclo de vida do token JWT
- Rejeição imediata na borda (`401 Unauthorized`) para requisições sem token válido
- Validação estrita de payload (`400 Bad Request`) para notas fora do intervalo, campos obrigatórios em branco ou tipos inválidos
- Delegação de requisições gRPC através do Gateway
- Persistência e integridade das avaliações no banco real SQLite
- Comunicação inter-serviços via Protocol Buffers

Para rodar todos os testes:

```bash
poetry run python -m unittest discover tests
```

---

## 🔐 Endpoints do API Gateway

### Autenticação (Públicos)
- `POST /auth/register` — Cadastra um novo usuário no banco via gRPC e retorna token JWT (`201 Created`).
- `POST /auth/login` — Autentica as credenciais do usuário via gRPC e retorna token JWT (`200 OK`).

### Perfil e Avaliações (Protegidos por JWT)
- `GET /auth/me` — Retorna dados do usuário autenticado (`Authorization: Bearer <token>`).
- `POST /reviews` — Registra uma nova crítica no banco real através do `ReviewService` gRPC. Exige header `Authorization: Bearer <token>`. Retorna `201 Created`.

### Catálogo e Consultas (Públicos)
- `GET /movies?query={termo}&page={n}` — Busca filmes no TMDb via `MovieService` gRPC (`200 OK`).
- `GET /movies/trending` — Retorna filmes em alta na semana via `MovieService` gRPC (`200 OK`).
- `GET /movies/{tmdb_id}` — Detalhes completos do filme via `MovieService` gRPC (`200 OK`).
- `GET /reviews` — Lista todas as críticas salvas no banco real via `ReviewService` gRPC (`200 OK`).
- `GET /reviews/movie/{tmdb_id}` — Lista críticas de um filme específico (`200 OK`).

Documentação Swagger interativa disponível em: **`http://localhost:8000/docs`**.
