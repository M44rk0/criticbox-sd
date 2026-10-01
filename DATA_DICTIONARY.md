# Dicionário de Dados — Criticbox SD

Este documento descreve detalhadamente o esquema de banco de dados relacional utilizado no projeto **Criticbox SD**, mapeado através do **SQLAlchemy 2.0** com suporte híbrido a **SQLite** (ambiente local e testes) e **MySQL / Cloud SQL** (ambiente de produção).

---

## 1. Tabela: `users`

Armazena as identidades dos usuários registrados na plataforma.

| Campo | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | **PRIMARY KEY**, NOT NULL | Identificador único universal imutável do usuário gerado no padrão UUID v4. |
| `username` | `VARCHAR(50)` | **UNIQUE**, NOT NULL, INDEX | Nome de usuário único para login e exibição pública na plataforma (mínimo de 1 caractere). |
| `password_hash` | `VARCHAR(255)` | NOT NULL | Hash criptográfico seguro da senha gerado via PBKDF2-HMAC-SHA256 no formato `salt_hex:kdf_hex` (100.000 iterações). |
| `created_at` | `VARCHAR(30)` | NOT NULL | Data e hora do cadastro do usuário em formato padronizado ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SS.mmmmmmZ`). |

---

## 2. Tabela: `reviews`

Armazena as avaliações feitas pela comunidade para filmes, séries completas ou episódios individuais.

| Campo | Tipo | Restrições | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | **PRIMARY KEY**, NOT NULL | Identificador único universal da avaliação gerado no formato UUID v4. |
| `tmdb_id` | `INTEGER` | NOT NULL, INDEX | Identificador numérico da obra no catálogo externo da API The Movie Database (TMDb). |
| `user_id` | `VARCHAR(50)` | NOT NULL, INDEX | Identificador (UUID) do usuário autor da avaliação. |
| `username` | `VARCHAR(50)` | NOT NULL, INDEX, DEFAULT `""` | Nome de exibição do autor no momento da publicação (desnormalizado para renderização rápida). |
| `rating` | `FLOAT` | NOT NULL, CHECK (`rating` entre `0.5` e `5.0`) | Nota atribuída pelo usuário, variando de 0.5 a 5.0 estrelas com incrementos de 0.5. |
| `comment` | `TEXT` | NOT NULL, DEFAULT `""` | Comentário textual da avaliação (validado na borda com limite máximo de 1000 caracteres). |
| `contains_spoilers` | `BOOLEAN` | NOT NULL, DEFAULT `FALSE` | Sinalizador booleano (`True`/`False` ou `1`/`0`) indicando se o comentário revela detalhes da trama. |
| `created_at` | `VARCHAR(30)` | NOT NULL, INDEX | Data e hora da publicação da avaliação em formato ISO 8601 UTC. |
| `media_type` | `VARCHAR(20)` | NOT NULL, DEFAULT `'movie'` | Tipo da mídia avaliada. Valores aceitos: `'movie'` (filme) ou `'tv'` (série de TV). |
| `season_number` | `INTEGER` | NULLABLE | Número da temporada avaliada (preenchido apenas quando a avaliação é direcionada a um episódio específico de série). |
| `episode_number` | `INTEGER` | NULLABLE | Número do episódio avaliado dentro da temporada (preenchido apenas quando a avaliação é direcionada a um episódio específico). |
| `movie_title` | `VARCHAR(255)` | NOT NULL, DEFAULT `""` | Título da obra gravado atomicamente no momento da avaliação para leitura imediata sem requisições adicionais. |
| `poster_url` | `VARCHAR(500)` | NOT NULL, DEFAULT `""` | URL completa da imagem do poster no CDN do TMDb, gravada na persistência para eliminar o gargalo de consultas N+1. |

---

## 3. Índices e Otimizações de Consulta

| Tabela | Nome do Índice | Coluna(s) Indexada(s) | Finalidade |
| :--- | :--- | :--- | :--- |
| `users` | `pk_users` | `id` | Busca primária e garantia de unicidade por ID. |
| `users` | `ix_users_username` | `username` | Busca rápida no fluxo de autenticação/login e validação de duplicidade. |
| `reviews` | `pk_reviews` | `id` | Chave primária de acesso direto à avaliação. |
| `reviews` | `ix_reviews_tmdb_id` | `tmdb_id` | Agregação rápida de notas médias e listagem de reviews de um filme/série (`GetReviewsByMovie`). |
| `reviews` | `ix_reviews_user_id` | `user_id` | Filtro das avaliações do histórico do usuário e cálculo do motor de afinidade (`GetReviewsByUser`). |
| `reviews` | `ix_reviews_username` | `username` | Filtro por nome de exibição de autor. |
| `reviews` | `ix_reviews_created_at` | `created_at` | Ordenação cronológica eficiente do feed geral de reviews recentes (`GetAllReviews`). |

---

## 4. Regras de Integridade e Negócio

1. **Unicidade de Avaliação por Usuário e Título**:
   - Um usuário só pode avaliar uma única vez a mesma obra ou o mesmo episódio específico.
   - Validação composta em: `(tmdb_id, user_id, season_number, episode_number)`.
2. **Restrição Temporal de Estreia**:
   - Uma avaliação só é aceita se a data de lançamento oficial da obra for igual ou anterior à data atual (`release_date <= hoje`).
3. **Escala de Avaliação**:
   - Apenas notas no intervalo de `0.5` a `5.0` (múltiplos de 0.5) são permitidas pelo Gateway e pela camada de persistência.
4. **Desnormalização Controlada**:
   - Os campos `movie_title` e `poster_url` são fixados no ato da gravação da avaliação. Isso garante que feeds com dezenas de avaliações sejam lidos instantaneamente em um único `SELECT`, sem disparar requisições em cascata para a API do TMDb.
