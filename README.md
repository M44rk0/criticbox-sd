# 🎬 Criticbox SD - Catálogo e Avaliação Distribuída de Filmes

Aplicação desenvolvida para a disciplina de **Sistemas Distribuídos (SD)**. O projeto combina um servidor **gRPC** e uma **API REST com FastAPI** em Python, integrando com a API do **TMDb (The Movie Database)** e banco de dados **SQLite** para catálogo e avaliação de filmes em tempo real.

---

## 🛠️ Tecnologias Utilizadas

- **Linguagem:** Python 3.10+
- **Gerenciador de Dependências:** [Poetry](https://python-poetry.org/)
- **API REST (Aulas 5 e 6):** [FastAPI](https://fastapi.tiangolo.com/), [Pydantic v2](https://docs.pydantic.dev/) & [Uvicorn](https://www.uvicorn.org/)
- **Comunicação RPC:** [gRPC](https://grpc.io/) & [Protocol Buffers (proto3)](https://protobuf.dev/)
- **Banco de Dados:** SQLite
- **API Externa:** [TMDb API](https://www.themoviedb.org/documentation/api) (`tmdbsimple`)
- **Linters & Qualidade:** Ruff

---

## 📁 Estrutura do Projeto

```text
criticbox-sd/
├── criticbox_sd/
│   ├── api/                   # Módulo da API REST (FastAPI)
│   │   ├── __init__.py
│   │   ├── main.py            # Servidor FastAPI, rotas e handlers de validação
│   │   └── schemas.py         # Modelos e validações com Pydantic (DTOs)
│   ├── client/
│   │   └── client.py          # Cliente gRPC interativo (CLI)
│   ├── generated/             # Arquivos Python gerados pelo protoc (stubs)
│   ├── proto/
│   │   └── criticbox.proto    # Definições das mensagens e serviços gRPC
│   ├── scripts/
│   │   └── compile_proto.py   # Script para compilar o arquivo .proto
│   └── server/
│       ├── database.py        # Camada de persistência SQLite (criticbox.db)
│       ├── server.py          # Servidor gRPC principal
│       └── tmdb_service.py    # Cliente de integração com a API do TMDb
├── tests/
│   ├── test_api.py            # Testes automatizados da API REST (FastAPI)
│   └── test_reviews.py        # Testes do serviço gRPC e banco
├── .env.example               # Template de variáveis de ambiente
├── .gitignore                 # Arquivos ignorados pelo Git
├── pyproject.toml             # Configurações do Poetry e dependências
└── README.md                  # Documentação do projeto
```

---

## ⚙️ Pré-requisitos

- **Python 3.10 ou superior** instalado na máquina.
- **Poetry** instalado (`pip install poetry` ou via script oficial).
- Uma chave de API do **TMDb** (obtenha gratuitamente em [themoviedb.org](https://www.themoviedb.org/settings/api)).

---

## 🚀 Instalação e Configuração

### 1. Clonar o Repositório e Instalar Dependências

```bash
# Entrar no diretório do projeto
cd criticbox-sd

# Instalar todas as dependências via Poetry
poetry install
```

### 2. Configurar as Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:

```bash
# No Linux/macOS
cp .env.example .env

# No Windows (PowerShell)
Copy-Item .env.example .env
```

Edite o arquivo `.env` e insira sua chave da API do TMDb:

```env
TMDB_API_KEY=cole_sua_chave_aqui
GRPC_SERVER_HOST=localhost
GRPC_SERVER_PORT=50051
API_PORT=8000
```

---

## 🌐 API REST com FastAPI (Aulas 5 e 6 de SD)

A API REST disponibiliza endpoints HTTP para registro e consulta de reviews com validação de campos (análoga às validações do Bean Validation do Spring na Aula 6) e persistência no banco SQLite.

### Iniciar o Servidor FastAPI

```bash
# Opção 1: Atalho configurado no Poetry
poetry run api

# Opção 2: Direto via Uvicorn com hot-reload
poetry run uvicorn criticbox_sd.api.main:app --reload --port 8000
```

> A aplicação iniciará na porta `8000`. A documentação interativa Swagger estará disponível em [http://localhost:8000/docs](http://localhost:8000/docs).

### Rotas e Exemplos de Uso com `curl`

#### 1. Buscar Filmes no TMDb (`GET /movies` -> `200 OK`)

Realiza a busca de filmes por termo no TMDb com paginação e calcula a média de notas e total de reviews registradas no Criticbox:

```bash
curl -i -X GET "http://localhost:8000/movies?query=Clube%20da%20Luta&page=1"
```

#### 2. Criar Review com Sucesso (`POST /reviews` -> `201 Created`)

```bash
curl -i -X POST http://localhost:8000/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "tmdb_id": 550,
    "user_id": "marcodev",
    "rating": 4.5,
    "comment": "Clube da Luta e sensacional!",
    "contains_spoilers": false
  }'
```

**Resposta HTTP 201:**
```json
{
  "review_id": "e0a17f65-8db8-406b-a2c3-9b19dfb4a4cb",
  "tmdb_id": 550,
  "user_id": "marcodev",
  "rating": 4.5,
  "comment": "Clube da Luta e sensacional!",
  "contains_spoilers": false,
  "created_at": "2026-09-24 22:15:21",
  "success": true,
  "message": "Review registrada com sucesso!"
}
```

#### 2. Testar Validação de Erro (`POST /reviews` -> `400 Bad Request`)

Simulando campos inválidos (nota fora do intervalo permitido de 0.5 a 5.0 e `user_id` em branco):

```bash
curl -i -X POST http://localhost:8000/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "tmdb_id": 550,
    "user_id": "   ",
    "rating": 6.5,
    "comment": "Teste invalido"
  }'
```

**Resposta HTTP 400 (formato amigável e em português):**
```json
{
  "mensagem": "Dados inválidos",
  "erros": [
    {
      "campo": "user_id",
      "mensagem": "O nome de usuário não pode estar em branco."
    },
    {
      "campo": "rating",
      "mensagem": "A nota deve estar entre 0.5 e 5.0 estrelas."
    }
  ]
}
```

#### 3. Listar Todas as Reviews (`GET /reviews` -> `200 OK`)

```bash
curl -i -X GET http://localhost:8000/reviews
```

---

## 📡 Comunicação Cliente-Servidor gRPC

Para testar o microsserviço gRPC:

### Terminal 1: Iniciar Servidor gRPC

```bash
poetry run python criticbox_sd/server/server.py
```
> O servidor iniciará escutando em `0.0.0.0:50051`.

### Terminal 2: Iniciar Cliente CLI gRPC

```bash
poetry run python criticbox_sd/client/client.py
```

### Serviços gRPC Disponíveis (`criticbox.proto`)

| RPC | Descrição |
| :--- | :--- |
| `SearchMovies` | Realiza busca paginada de filmes por título no TMDb. |
| `CreateReview` | Registra uma nova crítica/avaliação no banco SQLite. |
| `GetAllReviews` | Retorna todas as reviews cadastradas com título do filme associado. |

---

## 🧪 Testes Automatizados

Para executar todos os testes da aplicação (API REST e gRPC):

```bash
poetry run python -m unittest discover -s tests
```
