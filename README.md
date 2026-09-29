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
| **Frontend** | Interface completa em **React** (Vite) no diretório `frontend/` e protótipo standalone `criticbox_home.html`, com tema Dark Brutalista, seletor de estrelas (0.5 a 5.0), busca dinâmica com debounce e modal de autenticação. Comunica-se **exclusivamente com o API Gateway**. |
| **API Gateway** | Desenvolvido em **FastAPI**, escutando em `http://localhost:8000`. Recebe HTTP/JSON, valida schemas, autentica JWT e orquestra chamadas gRPC para os microsserviços internos. |
| **Backend com 2 Microsserviços** | 1) **MovieService** (porta 50051) e 2) **ReviewService** (porta 50052). Ambos expõem serviços gRPC definidos via Protocol Buffers (`movie.proto` e `review.proto`). |
| **Comunicação Inter-serviços** | O `MovieService` consulta o `ReviewService` via gRPC (`GetMovieStats`) para agregar a média Criticbox às listagens de filmes em tempo real. |
| **Banco de Dados Real** | Persistência real em **SQLite** (`criticbox.db`) com tabelas relacionais `users` e `reviews` (suporte a MySQL configurável via `.env`). Zero mocks ou dados estáticos. |
| **Validação no Gateway** | Schemas Pydantic rigorosos. Retorno semântico explícito de `400 Bad Request` com lista detalhada de campos faltantes/inválidos, `201 Created` para inserções e `200 OK` para consultas. |
| **Segurança (JWT)** | Middleware/dependência de segurança que valida `Authorization: Bearer <token>`. Requisições sem token válido são imediatamente barradas na borda com `401 Unauthorized`. |
| **Tradução de Protocolo** | O Gateway desserializa JSON, valida, serializa em mensagens binárias Protobuf, invoca o stub gRPC e converte a resposta binária em JSON para o cliente. |

---

## 🛠️ Tecnologias Utilizadas

- **Linguagem Backend:** Python 3.10+
- **Frontend:** React 19, Vite, CSS Vanilla Moderno
- **API Gateway:** FastAPI, Uvicorn, Pydantic v2
- **Segurança:** PyJWT, PBKDF2-HMAC-SHA256 (hashing seguro de senhas)
- **RPC & Serialização:** gRPC, Protocol Buffers (`proto3`)
- **Banco de Dados:** SQLite (local) / MySQL (Cloud SQL)
- **API Externa de Catálogo:** TMDb API (`tmdbsimple`)
- **Gerenciador de Dependências:** Poetry

---

## 📁 Estrutura de Arquivos

```text
criticbox-sd/
├── criticbox_sd/
│   ├── api/
│   │   ├── auth.py              # Utilitários de JWT e dependência de autenticação (401)
│   │   ├── grpc_clients.py      # Gerenciador de stubs gRPC e tradução HTTP <-> Protobuf
│   │   ├── main.py              # API Gateway FastAPI (rotas públicas e protegidas)
│   │   └── schemas.py           # DTOs e validações semânticas Pydantic (400)
│   ├── generated/               # Stubs Python gerados pelo protoc
│   │   ├── movie_pb2.py
│   │   ├── movie_pb2_grpc.py
│   │   ├── review_pb2.py
│   │   └── review_pb2_grpc.py
│   ├── proto/                   # Contratos de interface IDL (Protocol Buffers)
│   │   ├── movie.proto          # Serviço de filmes e catálogo
│   │   └── review.proto         # Serviço de reviews e autenticação de usuários
│   ├── scripts/
│   │   └── compile_proto.py     # Compilador dos arquivos .proto
│   ├── server/
│   │   ├── database.py          # Camada de persistência real SQLite/MySQL
│   │   ├── movie_service.py     # Microsserviço gRPC de Catálogo (porta 50051)
│   │   ├── review_service.py    # Microsserviço gRPC de Reviews e Usuários (porta 50052)
│   │   └── tmdb_service.py      # Integração externa TMDb
│   └── run_all.py               # Orquestrador unificado para inicialização local
├── frontend/                    # Aplicação Web SPA (React + Vite)
│   ├── src/
│   │   ├── App.jsx              # Interface completa (Autenticação, Busca, Reviews)
│   │   ├── index.css            # Sistema de design dark brutalista
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js           # Proxy reverso para o API Gateway
├── tests/
│   ├── test_api.py              # Testes automatizados do Gateway, JWT e gRPC
│   └── test_reviews.py          # Testes unitários de persistência e serviços
├── criticbox_home.html          # Protótipo visual brutalista integrado
├── .env.example                 # Exemplo de configuração
├── pyproject.toml               # Dependências Poetry e scripts
└── README.md
```

---

## 🚀 Como Executar

### 1. Pré-requisitos
- Python 3.10+
- Poetry (`pip install poetry`)
- Node.js 18+ e npm

### 2. Instalação das Dependências

```bash
# Na raiz do projeto (backend Python):
poetry install

# No diretório do frontend (React):
cd frontend
npm install
cd ..
```

### 3. Configuração do `.env`

Copie o `.env.example` para `.env` se ainda não tiver feito:
```bash
cp .env.example .env
```
*(Opcional: insira sua chave TMDb em `TMDB_API_KEY`, ou utilize a chave de demonstração já pré-configurada).*

---

### 4. Executando a Aplicação

#### Opção A: Executar Tudo com Comando Único (Recomendado)

O script `run_all.py` inicia simultaneamente os dois microsserviços gRPC e o API Gateway:

```bash
poetry run start
```

Saída no console:
```text
======================================================================
INICIANDO ECOSSISTEMA DISTRIBUÍDO CRITICBOX (ENTREGA 2)
======================================================================
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

Se desejar acompanhar os logs de cada microsserviço em terminais isolados:

1. **Terminal 1 — Microsserviço de Reviews e Usuários (gRPC 50052):**
   ```bash
   poetry run review-service
   ```

2. **Terminal 2 — Microsserviço de Filmes e Catálogo (gRPC 50051):**
   ```bash
   poetry run movie-service
   ```

3. **Terminal 3 — API Gateway FastAPI (HTTP 8000):**
   ```bash
   poetry run api
   ```

4. **Terminal 4 — Frontend React:**
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
