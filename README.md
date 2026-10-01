# 🎬 Criticbox SD — Arquitetura Distribuída

Sistema distribuído de catálogo e avaliação de filmes e séries desenvolvido para a disciplina de **Sistemas Distribuídos (SD)**. A solução implementa um ecossistema desacoplado seguindo o padrão **Monorepo**, composto por **Frontend Web moderno (React + Vite)**, um **API Gateway centralizador (FastAPI)** com autenticação **JWT**, e **3 Microsserviços internos comunicando-se via gRPC (Protocol Buffers)** com persistência em banco relacional via **SQLAlchemy 2.0 ORM (SQLite / MySQL)**.

---

## 🏛️ Visão Geral da Arquitetura Distribuída

```text
┌─────────────────────────────────────────────────────────────────┐
│                       Frontend (React / Vite)                   │
│   Interface visual brutalista, autenticação JWT, busca & notas  │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP / REST (Bearer Token)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│               API Gateway Centralizador (FastAPI :8000)         │
│  - Borda única de entrada REST                                  │
│  - Emissão e validação de tokens JWT (Bearer)                   │
│  - Validação estrita de entrada com Schemas Pydantic            │
│  - Tradução de Protocolos: HTTP/JSON ◄► gRPC/Protobuf binário   │
│  - Pool de canais gRPC persistentes (GatewayGRPCManager)        │
└────────┬───────────────────────┼───────────────────────┬────────┘
         │ gRPC / Protobuf       │ gRPC / Protobuf       │ gRPC / Protobuf
         │ (Porta 50053)         │ (Porta 50051)         │ (Porta 50052)
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   USER SERVICE  │     │  MOVIE SERVICE  │     │ REVIEW SERVICE  │
│     (:50053)    │     │     (:50051)    │     │     (:50052)    │
│ - Cadastro      │     │ - Busca filmes  │     │ - Criar reviews │
│ - Login & Auth  │     │ - Trending/Em   │     │ - Listar reviews│
│ - Hash bcrypt   │     │   cartaz        │     │ - Bloqueio de   │
│ - UUID imutável │     │ - Séries e guias│     │   spoilers      │
│                 │     │ - Recomendações │     │ - Médias e batch│
│                 │     │ - Cache em RAM  │     │   stats         │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │       │               │
         │                       │       └── gRPC inter ─┘
         │                       │           serviço     │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │ API Externa     │              │
         │              │ The Movie DB    │              │
         │              └─────────────────┘              │
         │                                               │
         └───────────────────────┬───────────────────────┘
                                 │ SQLAlchemy 2.0 ORM
                                 ▼
                       ┌───────────────────┐
                       │   Banco de Dados  │
                       │ (SQLite / MySQL)  │
                       └───────────────────┘
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
│   ├── tests/                  # Suíte de testes automatizados com pytest (122 testes)
│   ├── scripts/                # Utilitários (compilação de protobufs)
│   ├── pyproject.toml          # Dependências do Poetry e scripts de inicialização
│   ├── poetry.lock             # Lockfile isolado de dependências Python
│   ├── README.md               # Documentação interna do backend
│   └── run_all.py              # Orquestrador unificado para inicialização concorrente
│
├── frontend/                   # Aplicação Web SPA (React + Vite)
│   ├── src/                    # Componentes, páginas e design system
│   ├── package.json            # Dependências npm
│   ├── README.md               # Documentação interna do frontend
│   └── vite.config.js          # Configuração do Vite e proxies locais
│
├── ARCHITECTURE.md             # Documento de arquitetura detalhada
├── DATA_DICTIONARY.md          # Dicionário de dados relacional completo
├── DESIGN.md                   # Diretrizes visuais e tokens de design
└── README.md                   # Apresentação geral do projeto
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
INICIANDO ECOSSISTEMA DISTRIBUÍDO CRITICBOX
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

O projeto conta com uma suíte de **122 testes automatizados** com **97% de cobertura** testando:
- Autenticação, emissão e validação estrita do token JWT
- Rejeição na borda (`401 Unauthorized`) para requisições não autenticadas
- Validação de entrada Pydantic (`400 Bad Request`) e prevenção de conflitos (`409 Conflict`)
- Servicers gRPC (`UserService`, `MovieService`, `ReviewService`)
- Persistência e integridade das tabelas relacionais com SQLAlchemy 2.0 ORM
- Integração TMDb com cache thread-safe em RAM e motor de recomendação por afinidade

Para rodar todos os testes com relatório de cobertura:

```bash
cd backend
poetry run pytest --cov=gateway --cov=services
```

---

## 🔐 Endpoints do API Gateway

### Autenticação (Públicos)
- `POST /auth/register` — Cadastra um novo usuário no banco via gRPC e retorna token JWT (`201 Created`).
- `POST /auth/login` — Autentica as credenciais do usuário via gRPC e retorna token JWT (`200 OK`).

### Perfil e Avaliações (Protegidos por JWT)
- `GET /auth/me` — Retorna dados do perfil do usuário autenticado (`Authorization: Bearer <token>`).
- `POST /reviews` — Registra uma nova crítica no banco real através do `ReviewService` gRPC (`201 Created`).

### Catálogo e Consultas (Públicos)
- `GET /movies?query={termo}&page={n}` — Busca filmes no catálogo via `MovieService` gRPC (`200 OK`).
- `GET /movies/trending` — Filmes em alta na semana (`200 OK`).
- `GET /movies/trending-tv` — Séries em alta na semana (`200 OK`).
- `GET /movies/now-playing` — Filmes em cartaz nos cinemas (`200 OK`).
- `GET /movies/recommendations?user_id={id}` — Recomendações personalizadas baseadas nas notas do usuário (`200 OK`).
- `GET /movies/{tmdb_id}` — Detalhes completos de filme ou série com elenco e provedores de streaming (`200 OK`).
- `GET /movies/{tmdb_id}/season/{season_number}` — Episódios de uma temporada específica (`200 OK`).
- `GET /movies/{tmdb_id}/episodes` — Guia completo de episódios de todas as temporadas (`200 OK`).
- `GET /reviews?limit={n}` — Lista as críticas mais recentes salvas no banco real (`200 OK`).
- `GET /reviews/movie/{tmdb_id}` — Lista todas as críticas de um título específico (`200 OK`).
- `GET /reviews/user/{user_id}` — Lista todas as críticas publicadas por determinado usuário (`200 OK`).

Documentação Swagger interativa disponível em: **`http://localhost:8000/docs`**.

---

## 📚 Documentação Complementar

- [ARCHITECTURE.md](file:///c:/Users/mrksm/OneDrive/Área%20de%20Trabalho/Projetos/Criticbox%20SD/criticbox-sd/ARCHITECTURE.md): Detalhamento aprofundado dos microsserviços, gRPC, HTTP/2, pooling e tratamento de exceções.
- [DATA_DICTIONARY.md](file:///c:/Users/mrksm/OneDrive/Área%20de%20Trabalho/Projetos/Criticbox%20SD/criticbox-sd/DATA_DICTIONARY.md): Dicionário de dados das tabelas relacionais `users` e `reviews` com campos, tipos, restrições e índices.
- [DESIGN.md](file:///c:/Users/mrksm/OneDrive/Área%20de%20Trabalho/Projetos/Criticbox%20SD/criticbox-sd/DESIGN.md): Diretrizes de design system, tipografia e tokens da interface brutalista.
