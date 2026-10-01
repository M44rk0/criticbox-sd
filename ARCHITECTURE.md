# Arquitetura Distribuída — Criticbox SD (Entrega 2)

Este documento descreve detalhadamente a arquitetura do projeto **Criticbox SD**, explicando o papel de cada componente, a divisão em microsserviços, o funcionamento do gRPC, a atuação do API Gateway e como as informações trafegam entre as camadas.

---

## 1. Visão Geral da Arquitetura

O Criticbox foi estruturado segundo o padrão **API Gateway com Microsserviços Internos via gRPC**. 

Em vez de uma aplicação monolítica onde rotas HTTP acessam o banco diretamente, o sistema foi desacoplado em 4 componentes autônomos que conversam entre si:

1. **Frontend (SPA React)**: Interface com o usuário no navegador.
2. **API Gateway (FastAPI / REST)**: Ponto único de entrada para a web, responsável por segurança, validações e orquestração.
3. **UserService (gRPC / :50053)**: Microsserviço dedicado a identidades, cadastro, validação de credenciais e hash seguro com bcrypt.
4. **MovieService (gRPC / :50051)**: Microsserviço focado no catálogo de títulos, integração com a API do TMDb, episódios e recomendações.
5. **ReviewService (gRPC / :50052)**: Microsserviço focado na persistência de avaliações, moderação/spoilers e cálculo agregado de notas.

### Diagrama da Topologia

```
+-----------------------------------------------------------------------------------+
|                                CLIENTE / NAVEGADOR                                |
|                              React SPA (Vite / JS)                                |
+-----------------------------------------------------------------------------------+
                                          |
                                  HTTP / REST (JSON)
                                          v
+-----------------------------------------------------------------------------------+
|                        API GATEWAY (FastAPI / Porta 8000)                         |
|  - Roteamento REST (/auth, /movies, /reviews)                                     |
|  - Validação de entrada na borda com Schemas Pydantic                             |
|  - Emissão e validação de tokens JWT (Bearer Auth)                                |
|  - Tradução de exceções gRPC para códigos de status HTTP                          |
|  - Pool de canais gRPC persistentes (GatewayGRPCManager)                          |
+-----------------------------------------------------------------------------------+
         |                                |                                |
   gRPC / HTTP/2                    gRPC / HTTP/2                    gRPC / HTTP/2
   (user.proto)                     (movie.proto)                    (review.proto)
         |                                |                                |
         v                                v                                v
+--------------------+           +--------------------+           +--------------------+
|    USER SERVICE    |           |   MOVIE SERVICE    |           |   REVIEW SERVICE   |
|      (:50053)      |           |      (:50051)      |           |      (:50052)      |
| - Cadastro usuários|           | - Busca filmes/TV  |           | - Criar reviews    |
| - Login e auth     |           | - Trailers e elenco|           | - Listar reviews   |
| - Hash com bcrypt  |           | - Guias temporadas |           | - Bloqueio spoilers|
| - Busca por perfil |           | - Recomendações    |           | - Médias e ratings |
|                    |           | - Cache em memória |           | - Batch movie stats|
+--------------------+           +--------------------+           +--------------------+
         |                                |        |                       |
         |                                |        +-- chamada gRPC inter--+
         |                                |            serviço (:50052)    |
         |                                v                                |
         |                      +--------------------+                     |
         |                      |  API Externa TMDb  |                     |
         |                      |  (Metadados Web)   |                     |
         |                      +--------------------+                     |
         |                                                                 |
         +--------------------------------+--------------------------------+
                                          |
                                          v
                               +--------------------+
                               |   Banco de Dados   |
                               | (SQLite / MySQL)   |
                               +--------------------+
```

---

## 2. O Papel do API Gateway

O **API Gateway** roda na porta `8000` e atua como a única "porta de entrada" que o frontend ou qualquer cliente externo enxerga. Seus papéis centrais são:

1. **Desacoplamento do Cliente**: O navegador não precisa saber onde os microsserviços estão rodando, nem precisa suportar chamadas gRPC diretamente (o que exigiria proxies complexos como gRPC-Web). Ele consome uma API REST limpa em JSON.
2. **Centralização da Autenticação**:
   - Quando um usuário se cadastra ou faz login, o Gateway pede ao `UserService` para validar as credenciais.
   - Se válidas, o próprio Gateway gera um token **JWT (JSON Web Token)** assinado com validade de 24 horas.
   - Em rotas protegidas (como criar uma review), o Gateway valida o token no cabeçalho `Authorization: Bearer <token>` antes de delegar a requisição aos microsserviços.
3. **Validação de Borda**:
   - Usando modelos Pydantic, o Gateway barra requisições inválidas (ex: notas menores que 0.5 ou maiores que 5.0, comentários gigantes com mais de 1000 caracteres, ou campos em branco) antes de gastar recursos de rede com os microsserviços.
4. **Tratamento de Falhas Distribuídas**:
   - Se um microsserviço falhar ou estiver fora do ar, o Gateway captura o erro gRPC (`grpc.RpcError`) e devolve ao cliente uma resposta HTTP clara (ex: `503 Service Unavailable`), em vez de quebrar a conexão de forma inesperada.
5. **Gerenciamento de Canais gRPC**:
   - O Gateway mantém canais HTTP/2 persistentes abertos com os três microsserviços através da classe `GatewayGRPCManager`. Isso evita o custo de abrir uma conexão TCP a cada requisição (handshake reutilizado).

---

## 3. O que é o gRPC e Por Que Ele Foi Usado?

O **gRPC** (*Google Remote Procedure Call*) é um framework de comunicação entre sistemas distribuídos de alta performance. Ele se baseia em duas tecnologias principais:

1. **Protocol Buffers (Protobuf)**:
   - Em vez de trafegar texto puro em JSON (que é pesado e exige serialização de strings), o gRPC serializa os dados em **formato binário compacto**.
   - Os contratos são definidos em arquivos `.proto` (`user.proto`, `movie.proto` e `review.proto`), garantindo que tanto o cliente quanto o servidor concordem exatamente com os tipos de dados e nomes dos campos.
2. **HTTP/2 como Protocolo de Transporte**:
   - Permite **multiplexação**: múltiplas requisições e respostas podem trafegar simultaneamente pela mesma conexão TCP sem que uma bloqueie a outra.
   - Suporta cabeçalhos comprimidos e comunicação orientada a streaming, reduzindo significativamente a latência interna.

No Criticbox SD, toda a comunicação interna no cluster de backend ocorre via gRPC:
- Gateway ➔ UserService (Porta 50053)
- Gateway ➔ MovieService (Porta 50051)
- Gateway ➔ ReviewService (Porta 50052)
- MovieService ➔ ReviewService (comunicação inter-serviços)

---

## 4. Os Microsserviços Internos

### 4.1. UserService (Porta 50053)
Implementado em `criticbox_sd/services/user_service.py`, este microsserviço é o guardião das identidades do sistema:
- **Autenticação Segura**: Armazena senhas com hash criptográfico usando `bcrypt`. A senha pura nunca é gravada no banco de dados.
- **Cadastro e Login**: Provê os RPCs `RegisterUser` e `AuthenticateUser`.
- **Separação de Responsabilidade (SRP)**: Isola regras de identidade e credenciais fora do escopo de reviews e mídias.

### 4.2. MovieService (Porta 50051)
Implementado em `criticbox_sd/services/movie_service.py`, este microsserviço gerencia todo o universo de catálogo de filmes e séries:
- **Integração com TMDb**: Realiza buscas, obtém detalhes, elenco, trailers do YouTube e plataformas de streaming (Netflix, Prime Video, etc.).
- **Paralelismo Concorrente**: Ao buscar detalhes de uma série de TV, usa um `ThreadPoolExecutor` para carregar em paralelo os episódios de múltiplas temporadas.
- **Cache Thread-Safe com TTL**: Armazena em memória os resultados de consultas frequentes por 10 minutos. Se o cache atingir o limite (`MAX_CACHE_SIZE = 1000`), remove automaticamente chaves expiradas ou os 20% mais antigos.
- **Motor de Recomendação Inteligente**: Analisa as reviews positivas de um usuário (nota >= 3.0), calcula a afinidade com gêneros de filmes e recomenda títulos semelhantes. Se o usuário for anônimo ou novo, entrega os títulos mais aclamados.
- **Cliente gRPC Inter-Serviço**: Para mostrar a nota média e o número de reviews do Criticbox junto com os dados do filme, o `MovieService` faz uma chamada gRPC direta ao `ReviewService` (`GetMovieStats` ou `GetBatchMovieStats`).

### 4.3. ReviewService (Porta 50052)
Implementado em `criticbox_sd/services/review_service.py`, este microsserviço é focado exclusivamente na experiência da comunidade e avaliações:
- **Controle de Avaliações**:
  - Permite avaliar tanto um título completo (filme ou série) quanto episódios individuais (definindo temporada e número do episódio).
  - Regra de Negócio: Bloqueia avaliações de títulos que ainda não estrearam oficialmente nos cinemas ou na TV.
  - Suporte a marcação de spoilers (comentários com spoilers são sinalizados para o front ocultar por padrão).
- **Cálculo de Estatísticas em Batch**: Oferece o RPC `GetBatchMovieStats`, permitindo que uma lista de IDs de filmes receba suas médias e contagens em uma única chamada agregada, evitando consultas repetidas ao banco.

---

## 5. Fluxos de Funcionamento Passo a Passo

### Fluxo A: Cadastro e Login do Usuário
1. O usuário preenche nome e senha no formulário do frontend e clica em Entrar.
2. O navegador dispara um `POST /auth/login` em JSON para o Gateway.
3. O Gateway valida o formato dos dados com o schema `UserLoginRequest`.
4. O Gateway invoca o RPC `AuthenticateUser` no `UserService` (:50053) via gRPC.
5. O `UserService` consulta o hash no banco de dados e verifica a senha com `bcrypt.checkpw()`.
6. Se a senha for correta, o `UserService` devolve sucesso e o ID do usuário ao Gateway.
7. O Gateway gera um token JWT contendo `user_id` e `username`, devolvendo-o ao navegador em formato JSON com código HTTP 200.
8. O frontend armazena o token no `localStorage` e passa a enviá-lo nas próximas requisições.

### Fluxo B: Abertura da Página de um Filme (Agregação Distribuída)
1. O usuário clica em um filme no frontend, que chama `GET /movies/550` no Gateway.
2. O Gateway repassa o pedido ao `MovieService` via RPC `GetMovieDetails`.
3. O `MovieService` executa duas ações em paralelo com threads:
   - Consulta o TMDb (ou o cache em memória) para obter sinopse, elenco, trailer e provedores.
   - Faz uma chamada gRPC inter-serviço ao `ReviewService` (`GetMovieStats`) para descobrir a nota média do Criticbox e o total de reviews já feitas pela comunidade.
4. O `MovieService` consolida todos esses dados em uma mensagem Protobuf única e responde ao Gateway.
5. O Gateway converte a mensagem para JSON e entrega a resposta completa ao navegador.

### Fluxo C: Envio de uma Avaliação (Review)
1. O usuário autenticado digita um comentário, escolhe uma nota (ex: 4.5 estrelas) e clica em Publicar.
2. O frontend envia `POST /reviews` com o cabeçalho `Authorization: Bearer <token>`.
3. O Gateway valida o token JWT (garantindo que o usuário é quem diz ser e que a sessão não expirou).
4. O Gateway valida o corpo da requisição (ex: garante que a nota está entre 0.5 e 5.0).
5. O Gateway chama o RPC `CreateReview` no `ReviewService` via gRPC.
6. O `ReviewService` verifica com o TMDb se o título já estreou. Se a data for futura, rejeita a review.
7. O `ReviewService` grava a review no banco de dados vinculada ao `user_id` (UUID imutável) e `username` (nome de exibição) do autor, com título e URL do poster inclusos de forma atômica (eliminando requisições extras posteriores).
8. O `ReviewService` responde sucesso com o novo ID da review criada, e o Gateway retorna HTTP 201 Created ao navegador.

---

## 6. Camada de Persistência e Otimizações de Desempenho

### 6.1. ORM com SQLAlchemy 2.0 e Suporte Híbrido (SQLite e Cloud SQL / MySQL)
A camada de persistência foi unificada utilizando o **SQLAlchemy 2.0**, desacoplada através do **Padrão Repository** (`models.py`, `connection.py`, `user_repository.py` e `review_repository.py`):
- **Modelos Declarativos Tipados (`models.py`)**:
  - `User`: Entidade de usuário com chave primária em UUID (`id`), login único indexado (`username`), `password_hash` e timestamp.
  - `Review`: Entidade de avaliações mapeando `id` (UUID), `tmdb_id`, `user_id` (UUID do autor), `username` (nome de exibição), nota (`rating`), comentários, spoilers, data e campos de série/filme (`media_type`, `season_number`, `episode_number`, `movie_title`, `poster_url`).
- **Auto-criação de Esquemas (`Base.metadata.create_all`)**:
  - Ao subir a aplicação ou executar testes, o SQLAlchemy inspeciona as entidades e cria automaticamente as tabelas e índices necessários no banco de destino.
  - Elimina a necessidade de scripts manuais de criação de tabelas ao fazer deploy no Google Cloud (Cloud SQL).
- **Flexibilidade de Ambientes**:
  - **SQLite (Desenvolvimento Local & Testes)**: Conexão via `sqlite:///{path}` configurada com modo **WAL (Write-Ahead Logging)**, `PRAGMA synchronous = NORMAL` e timeout para leituras e escritas concorrentes sem travamentos.
  - **Cloud SQL / MySQL (Produção GCP)**: Se variáveis como `DB_HOST`, `DB_USER`, `DB_PASSWORD` ou `DB_NAME` forem preenchidas no `.env`, a conexão é estabelecida de forma transparente via `mysql+pymysql://...` com pool de conexões reciclado e `pool_pre_ping`.
- **Sessões Transacionais (`get_session`)**:
  - Gerenciador de contexto thread-safe que executa as operações atômicas, com `commit()` automático ao concluir o bloco e `rollback()` preventivo em caso de qualquer exceção.

### 6.2. Eliminação do Gargalo N+1 ("Code Judo")
Em versões preliminares, listar 50 reviews exigia fazer 50 requisições HTTP adicionais ao TMDb para descobrir o título e o poster de cada obra avaliada. 
Na arquitetura atual:
- Ao salvar a review, gravamos `movie_title` e `poster_url` diretamente na linha do banco.
- Ao listar reviews (`GetAllReviews`, `GetReviewsByMovie`), os dados vêm imediatamente do banco de dados em uma única consulta, sem sobrecarregar a rede externa.
- Um script de manutenção em background (`backfill_posters.py`) atualiza retroativamente registros antigos.

### 6.3. Pré-aquecimento de Cache Concorrente
Ao iniciar o ecossistema com `poetry run start` (`run_all.py`):
1. O `UserService`, `ReviewService` e o `MovieService` sobem suas portas gRPC (`50053`, `50052` e `50051`).
2. Uma thread em background (`_warm_cache`) dispara imediatamente para buscar e armazenar em memória os títulos populares da semana e filmes em cartaz.
3. O API Gateway (`FastAPI`) inicia na porta `8000`.
4. Quando o primeiro usuário abre a página inicial, as informações já estão na memória RAM, garantindo carregamento instantâneo.

---

## 7. Mapeamento de Falhas (gRPC ➔ HTTP)

Para que o frontend receba códigos HTTP padronizados da web em vez de erros internos de socket, o arquivo `criticbox_sd/gateway/exception_handlers.py` faz a tradução:

| Código gRPC Interno | Código HTTP Devolvido | Cenário |
| :--- | :---: | :--- |
| `NOT_FOUND` | **404 Not Found** | Filme, série ou usuário não localizado. |
| `INVALID_ARGUMENT` | **400 Bad Request** | Dados enviados de forma incorreta. |
| `ALREADY_EXISTS` | **409 Conflict** | Usuário duplicado ou review repetida para o mesmo episódio. |
| `UNAUTHENTICATED` | **401 Unauthorized** | Token ausente, inválido ou expirado. |
| `PERMISSION_DENIED` | **403 Forbidden** | Operação restrita a outro usuário. |
| `UNAVAILABLE` | **503 Service Unavailable** | Microsserviço gRPC correspondente indisponível. |
| `DEADLINE_EXCEEDED` | **504 Gateway Timeout** | Tempo limite esgotado aguardando o microsserviço. |
| `INTERNAL` | **503 Service Unavailable** | Erro interno tratado com fallback seguro. |

---

## 8. Estrutura de Diretórios do Backend

A estrutura do projeto segue o desacoplamento padrão de microsserviços modernos:

```text
criticbox_sd/
├── gateway/                    # API Gateway (REST HTTP / FastAPI)
│   ├── auth.py                 # Emissão e validação de tokens JWT (Bearer)
│   ├── exception_handlers.py   # Mapeamento gRPC RpcError -> HTTP status
│   ├── grpc_clients.py         # Pool de stubs e canais gRPC persistentes
│   ├── main.py                 # Instância FastAPI e lifecycle das rotas
│   ├── routers/                # Sub-rotas REST da API
│   │   ├── auth.py             # Rotas /auth/register, /auth/login, /auth/me
│   │   ├── movies.py           # Rotas /movies/... (detalhes, busca, trending)
│   │   └── reviews.py          # Rotas /reviews/... (criação e listagem)
│   └── schemas/                # Schemas Pydantic tipados e modularizados
│       ├── auth.py             # Schemas de login, registro e perfil
│       ├── movies.py           # Schemas de catálogo, elenco e episódios
│       ├── reviews.py          # Schemas de criação e listagem de reviews
│       └── common.py           # Schemas de erros de validação e respostas genéricas
├── services/                   # Microsserviços Internos gRPC
│   ├── user_service.py         # Servicer gRPC UserService (:50053)
│   ├── movie_service.py        # Servicer gRPC MovieService (:50051)
│   ├── review_service.py       # Servicer gRPC ReviewService (:50052)
│   ├── storage/                # Camada de Persistência desacoplada
│   │   ├── connection.py       # Engine e Session Factory (SQLAlchemy 2.0)
│   │   ├── models.py           # Modelos ORM (User, Review)
│   │   ├── user_repository.py  # Repository de usuários
│   │   └── review_repository.py# Repository de avaliações
│   └── tmdb/                   # Módulo de integração TMDb & Recomendações
│       ├── client.py           # Cliente HTTP TMDb
│       ├── catalog.py          # Operações de catálogo e temporadas
│       ├── cache.py            # Cache thread-safe com TTL
│       ├── extractors.py       # Normalização de payloads externos
│       └── recommender.py      # Motor de recomendação baseado em afinidade
├── proto/                      # Contratos de interface Protocol Buffers
│   ├── user.proto
│   ├── movie.proto
│   └── review.proto
├── generated/                  # Código gerado pelo protoc para Python
├── scripts/                    # Scripts utilitários e de migração
└── run_all.py                  # Orquestrador local de inicialização concorrente
```

