# 🎬 Criticbox SD — Arquitetura Distribuída

Sistema distribuído de catálogo e avaliação de filmes e séries desenvolvido para a disciplina de **Sistemas Distribuídos (SD)**. A solução implementa um ecossistema desacoplado seguindo o padrão **Monorepo**, composto por **Frontend Web moderno (React + Vite)**, um **API Gateway centralizador (FastAPI)** com autenticação **JWT**, e **3 Microsserviços internos comunicando-se via gRPC (Protocol Buffers)** com persistência em banco relacional via **SQLAlchemy 2.0 ORM (SQLite / MySQL)** seguindo o padrão arquitetural **Database per Service (Bancos Isolados)**.

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
│ - Hash PBKDF2   │     │   cartaz        │     │ - Excluir review│
│ - UUID imutável │     │ - Séries e guias│     │ - Bloqueio de   │
│                 │     │ - Recomendações │     │   spoilers      │
│                 │     │ - Cache em RAM  │     │ - Médias e batch│
│                 │     │                 │──gRPC:50052──►  stats         │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │ API Externa     │              │
         │              │ The Movie DB    │              │
         │              │   (Stateless)   │              │
         │              └─────────────────┘              │
         ▼                                               ▼
┌─────────────────┐                             ┌─────────────────┐
│Banco de Usuários│                             │Banco de Reviews │
│(users.db/MySQL) │                             │(reviews.db/MySQL│
└─────────────────┘                             └─────────────────┘
```

---

## 📋 Requisitos Atendidos

| Requisito | Implementação no Criticbox |
|---|---|
| **Frontend** | Interface completa em **React** (Vite) no diretório `frontend/`, com tema Dark Brutalista, seletor de estrelas (0.5 a 5.0), busca dinâmica com debounce, modais de autenticação, tela de gerenciamento **"Minha Caixa"** (`MyBoxPage`) com histórico pessoal e exclusão de críticas, tela 404 personalizada (`NotFoundPage`) e detalhes completos com trailers e temporadas. Comunica-se **exclusivamente com o API Gateway**. |
| **API Gateway** | Desenvolvido em **FastAPI** (`backend/gateway`), escutando em `http://localhost:8000`. Recebe HTTP/JSON, valida schemas Pydantic, autentica JWT, injeta correlation ID (`X-Request-ID`) e orquestra chamadas gRPC para os microsserviços internos. |
| **Backend com 3 Microsserviços** | 1) **UserService** (porta 50053), 2) **MovieService** (porta 50051) e 3) **ReviewService** (porta 50052). Todos expõem serviços gRPC definidos via Protocol Buffers. |
| **Comunicação Inter-serviços** | O `MovieService` consulta o `ReviewService` via gRPC (`GetMovieStats` e `GetBatchMovieStats`) para agregar a média e o total de avaliações da comunidade às listagens em tempo real. |
| **Padrão Database per Service & ORM** | Persistência isolada por microsserviço com **SQLAlchemy 2.0** (`services/user_service/storage/` e `services/review_service/storage/`). Bancos físicos e esquemas independentes (`users.db` / `criticbox_users` e `reviews.db` / `criticbox_reviews`), com suporte híbrido (**SQLite** local com modo WAL e **Cloud SQL / MySQL** em nuvem). O `MovieService` atua de forma stateless com cache em RAM. |
| **Validação no Gateway & Enriquecimento** | Schemas Pydantic modulares em `backend/gateway/schemas/`. O Gateway valida parâmetros de entrada e enriquece reviews com metadados canônicos do `MovieService` antes de despachar a criação para o `ReviewService`. |
| **Segurança (JWT & PBKDF2)** | Hashing criptográfico de senhas com `PBKDF2-HMAC-SHA256` (100.000 iterações com salt) no `UserService` e emissão/validação de tokens JWT Bearer no Gateway. |
| **Observabilidade & Telemetria** | Rastreabilidade distribuída ponta a ponta com propagação de `X-Request-ID` do Gateway aos microsserviços via metadados gRPC (`TraceClientInterceptor` e `@traced_rpc`). |
| **Tradução de Protocolo** | O Gateway desserializa JSON, valida na borda, invoca os stubs gRPC via HTTP/2 binário e converte as respostas de volta para JSON para o cliente. |

---

## 🛠️ Tecnologias Utilizadas

- **Linguagem Backend:** Python 3.10+
- **Frontend:** React 19, Vite, CSS Vanilla Moderno
- **API Gateway:** FastAPI, Uvicorn, Pydantic v2
- **Segurança:** PyJWT, PBKDF2-HMAC-SHA256 (hashing criptográfico de senhas)
- **RPC & Serialização:** gRPC, Protocol Buffers (`proto3`)
- **Observabilidade:** Telemetria distribuída com correlation ID (`X-Request-ID` via ContextVar e gRPC metadata)
- **Banco de Dados & ORM:** SQLAlchemy 2.0 com padrão *Database per Service* (bancos dedicados e isolados para Usuários e Avaliações; suporte a SQLite local com WAL e Cloud SQL MySQL)
- **API Externa de Catálogo:** TMDb API (`tmdbsimple`)
- **Gerenciador de Dependências:** Poetry (backend) e npm (frontend)

---

## 💾 Persistência: Padrão Database per Service & Desnormalização

O ecossistema adota estritamente o padrão **Database per Service (Bancos Isolados)** para garantir independência de esquema e desacoplamento total entre os domínios:

1. **UserService (`users.db` / `criticbox_users`)**:
   - Persistência exclusiva em `backend/services/user_service/storage/`.
   - Gerencia a entidade declarativa `User` (subclasse de `UserBase`) com campos `id` (UUID imutável), `username` único indexado, `password_hash` (`PBKDF2-HMAC-SHA256`) e `created_at`.
   - A inicialização (`init_db`) cria estritamente a tabela `users`.
2. **ReviewService (`reviews.db` / `criticbox_reviews`)**:
   - Persistência exclusiva em `backend/services/review_service/storage/`.
   - Gerencia a entidade declarativa `Review` (subclasse de `ReviewBase`) mapeando `id`, `tmdb_id`, `user_id`, `username`, `rating`, `comment`, spoilers, episódios/temporadas e metadados.
   - **Desnormalização Otimizada**: Persistência atômica de `movie_title` e `poster_url` diretamente na review no momento da gravação. Viabiliza consultas em etapa única (*single-query reads*) na listagem de avaliações, desacoplando a comunidade de eventuais limites de taxa (*rate limits*) do TMDb.
   - A inicialização (`init_db`) cria estritamente a tabela `reviews`.
3. **MovieService (Stateless com Cache Concorrente em RAM)**:
   - Totalmente stateless em relação ao armazenamento relacional.
   - Cache em memória thread-safe com TTL de 10 minutos e agregação de médias através de chamadas **gRPC inter-serviço** (`GetMovieStats` e `GetBatchMovieStats`) ao `ReviewService`.
4. **ORM SQLAlchemy 2.0 & Suporte Híbrido**:
   - Modelos declarativos modernos com `Mapped` e `mapped_column`.
   - Context manager `get_session()` thread-safe com controle transacional atômico (`commit()` automático e `rollback()` preventivo em falhas).
   - Suporte híbrido transparente para **SQLite** local (com modo WAL e `PRAGMA synchronous = NORMAL`) e **Cloud SQL / MySQL** em nuvem (com pool de conexões reciclado e `pool_pre_ping`).

---

## 📁 Estrutura de Arquivos (Monorepo)

```text
criticbox-sd/
├── backend/                    # Projeto Python isolado (gRPC + Gateway)
│   ├── common/                 # Utilitários compartilhados e observabilidade
│   │   └── telemetry.py        # Rastreabilidade ponta a ponta e correlation ID
│   ├── gateway/                # API Gateway FastAPI (rotas REST, JWT, validações)
│   │   ├── auth.py             # Emissão e validação de tokens JWT (Bearer)
│   │   ├── exception_handlers.py # Tradução gRPC RpcError / ValueError -> HTTP status
│   │   ├── grpc_clients.py     # Pool de stubs e canais gRPC persistentes
│   │   ├── main.py             # Instância FastAPI e ciclo de vida da aplicação
│   │   ├── routers/            # Rotas /auth, /movies, /reviews (com Delete)
│   │   └── schemas/            # Schemas Pydantic modulares por domínio
│   ├── services/               # Microsserviços internos gRPC (Pacotes Autônomos)
│   │   ├── user_service/       # Microsserviço de Identidade (:50053)
│   │   │   ├── servicer.py     # Implementação gRPC (UserService)
│   │   │   └── storage/        # Banco de Dados Exclusivo (users.db / criticbox_users)
│   │   ├── movie_service/      # Microsserviço de Catálogo e Mídia (:50051 / Stateless)
│   │   │   └── servicer.py     # Implementação gRPC (MovieService)
│   │   ├── review_service/     # Microsserviço de Avaliações (:50052)
│   │   │   ├── servicer.py     # Implementação gRPC (ReviewService)
│   │   │   └── storage/        # Banco de Dados Exclusivo (reviews.db / criticbox_reviews)
│   │   └── tmdb/               # Integração TMDb, cache TTL e recomendações
│   ├── proto/                  # Contratos IDL Protocol Buffers
│   ├── generated/              # Stubs Python gerados pelo protoc
│   ├── tests/                  # Suíte de testes automatizados com pytest (141 testes)
│   ├── scripts/                # Utilitários (compilação de protobufs)
│   ├── pyproject.toml          # Dependências do Poetry e scripts de inicialização
│   ├── poetry.lock             # Lockfile isolado de dependências Python
│   ├── README.md               # Documentação interna do backend
│   └── run_all.py              # Orquestrador unificado para inicialização concorrente
│
├── frontend/                   # Aplicação Web SPA (React + Vite)
│   ├── src/                    # Componentes, páginas (Home, Detalhes, Minha Caixa, 404)
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

O projeto conta com uma suíte de **141 testes automatizados** com **100% de aprovação** testando:
- Autenticação, emissão e validação estrita do token JWT
- Rejeição na borda (`401 Unauthorized`) para requisições não autenticadas
- Validação de entrada Pydantic (`400 Bad Request`), limites int32 no `tmdb_id` e prevenção de conflitos (`409 Conflict`)
- Servicers gRPC (`UserService`, `MovieService`, `ReviewService`)
- Persistência e integridade das tabelas relacionais com SQLAlchemy 2.0 ORM em repositórios isolados (*Database per Service*)
- Integração TMDb com cache thread-safe em RAM e motor de recomendação por afinidade
- Telemetria distribuída, propagação de correlation ID (`X-Request-ID`) e interceptors gRPC
- Exclusão atômica de avaliações com controle estrito de autoria (`DeleteReview`)

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
- `POST /reviews` — Registra uma nova crítica no banco real através do `ReviewService` gRPC com metadados canônicos do `MovieService` (`201 Created`).
- `DELETE /reviews/{review_id}` — Exclui uma avaliação do próprio autor no banco real através do `ReviewService` gRPC (`200 OK`).

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

