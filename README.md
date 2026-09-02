# 🎬 Criticbox SD - Microsserviço gRPC de Avaliação de Filmes

Aplicação distribuída desenvolvida para a disciplina de **Sistemas Distribuídos (SD)**. O projeto combina um servidor **gRPC** em Python com integração à API do **TMDb (The Movie Database)** e banco de dados **SQLite** para catálogo e avaliação de filmes em tempo real.

---

## 🛠️ Tecnologias Utilizadas

- **Linguagem:** Python 3.10+
- **Gerenciador de Dependências:** [Poetry](https://python-poetry.org/)
- **Comunicação:** [gRPC](https://grpc.io/) & [Protocol Buffers (proto3)](https://protobuf.dev/)
- **Banco de Dados:** SQLite
- **API Externa:** [TMDb API](https://www.themoviedb.org/documentation/api) (`tmdbsimple`)
- **Linters & Qualidade:** Ruff

---

## 📁 Estrutura do Projeto

```text
criticbox-sd/
├── criticbox_sd/
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

## 🚀 Como Executar o Projeto

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
```

### 3. Compilar os Arquivos Protocol Buffers (opcional)

Os arquivos gRPC compilados já acompanham o projeto, mas se alterar o arquivo `criticbox.proto`, recompile rodando:

```bash
poetry run python criticbox_sd/scripts/compile_proto.py
```

---

## 🧪 Executando a Comunicação Cliente-Servidor

Para testar a aplicação, abra **dois terminais distintos**:

### 📡 Terminal 1: Iniciar o Servidor gRPC

```bash
poetry run python criticbox_sd/server/server.py
```
> O servidor iniciará e exibirá a mensagem: `[*] Servidor gRPC Criticbox escutando em 0.0.0.0:50051`. Ele mostrará os logs de cada requisição RPC recebida em tempo real.

### 💻 Terminal 2: Iniciar o Cliente gRPC

```bash
poetry run python criticbox_sd/client/client.py
```
> Um menu interativo no terminal será aberto permitindo:
> 1. **Buscar Filmes:** Pesquisa filmes no TMDb.
> 2. **Escrever Review:** Envia nota (0.5 a 5.0), comentário e flag de spoiler.
> 3. **Listar Reviews de Todos os Usuários:** Exibe todas as reviews cadastradas no sistema, com usuário, filme e conteúdo da avaliação.

---

## 🔌 Serviços gRPC Disponíveis (`criticbox.proto`)

| RPC | Descrição |
| :--- | :--- |
| `SearchMovies` | Realiza busca paginada de filmes por título. |
| `CreateReview` | Registra uma nova crítica/avaliação no banco SQLite. |
| `GetAllReviews` | Retorna todas as reviews de todos os usuários com o título do filme associado. |
