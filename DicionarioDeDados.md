# Dicionário de Dados — Sistema de Avaliação de Filmes

> Documento de referência para o plano de projeto. Descreve as entidades `User` e `Review`, seus atributos, tipos, restrições e as tabelas de apoio necessárias para viabilizar o caráter cooperativo do sistema (amigos, sessões conjuntas, integração com TMDB).

---

## 1. Entidade: `User`

Representa um usuário cadastrado na plataforma. Além dos dados de conta, carrega estatísticas agregadas que sustentam a experiência social/cooperativa (perfil, amigos, histórico).

### Tabela: `users`

| Campo | Tipo | Nulo? | Restrições / Domínio | Descrição |
|---|---|---|---|---|
| `user_id` | `integer` (PK, auto-increment) | Não | Único, sequencial | Identificador único e imutável do usuário. |
| `username` | `varchar(32)` | Não | Único, sem espaços | Nome de exibição/login. Pode ser alterado pelo usuário. |
| `email` | `varchar(255)` | Não | Único, formato de e-mail válido | Usado para login e recuperação de conta. |
| `password_hash` | `varchar(255)` | Não | Hash (bcrypt/argon2), nunca texto puro | Senha do usuário, armazenada de forma segura. |
| `display_name` | `varchar(64)` | Sim | — | Nome de exibição opcional, diferente do `username`. |
| `avatar_url` | `varchar(512)` | Sim | URL válida | Foto de perfil. |
| `bio` | `varchar(256)` | Sim | Máx. 256 caracteres | Descrição curta do usuário. |
| `is_private` | `boolean` | Não | Default `false` | Se `true`, reviews e listas só ficam visíveis para amigos aprovados. |
| `total_movies_watched` | `integer` (calculado) | Não | Default `0`, `≥ 0` | Total de filmes distintos com `review` registrada pelo usuário. Sugestão: campo **derivado/cacheado**, recalculado via trigger ou job, não editável diretamente. |
| `total_reviews` | `integer` (calculado) | Não | Default `0`, `≥ 0` | Total de avaliações feitas (pode ser `> total_movies_watched` se reavaliações forem permitidas). |
| `average_rating_given` | `decimal(3,2)` (calculado) | Sim | `0.0 ≤ x ≤ 5.0` | Média das notas públicas dadas pelo usuário. Útil para comparar "perfis de crítico" entre amigos. |
| `friends_count` | `integer` (calculado) | Não | Default `0`, `≥ 0` | Total de amizades confirmadas (ver `friendships`). |
| `favorite_genres` | `array<string>` (calculado) | Sim | — | Gêneros mais frequentes entre os filmes avaliados; gerado periodicamente a partir das reviews. |
| `created_at` | `datetime` | Não | Auto no cadastro | Data de criação da conta. |
| `updated_at` | `datetime` | Não | Auto a cada alteração | Última atualização do perfil. |
| `last_login_at` | `datetime` | Sim | — | Última vez que o usuário acessou o sistema. |

> **Nota sobre campos calculados:** `total_movies_watched`, `total_reviews`, `average_rating_given`, `friends_count` e `favorite_genres` não devem ser inseridos manualmente pelo cliente da aplicação — são derivados de `reviews` e `friendships`. Documentar no plano se serão **calculados em tempo real (query)** ou **cacheados na tabela `users`** (mais rápido para exibir perfil, mas exige rotina de atualização).

---

### Tabela: `friendships` (relação cooperativa entre usuários)

Substitui um possível campo solto tipo `friends: array[username]`, evitando duplicação e permitindo estados de convite.

| Campo | Tipo | Nulo? | Restrições / Domínio | Descrição |
|---|---|---|---|---|
| `friendship_id` | `integer` (PK, auto-increment) | Não | Único | Identificador da relação. |
| `requester_id` | `integer` (FK → `users.user_id`) | Não | — | Usuário que enviou o pedido de amizade. |
| `addressee_id` | `integer` (FK → `users.user_id`) | Não | `≠ requester_id` | Usuário que recebeu o pedido. |
| `status` | `enum('pending','accepted','declined','blocked')` | Não | Default `'pending'` | Estado atual da relação. |
| `created_at` | `datetime` | Não | Auto | Data do pedido. |
| `responded_at` | `datetime` | Sim | — | Data em que o pedido foi aceito/recusado. |

> Restrição única sugerida: `(requester_id, addressee_id)` não pode se repetir — evita pedidos duplicados.

---

## 2. Entidade: `Review` (Avaliação)

### Tabela: `reviews`

| Campo | Tipo | Nulo? | Restrições / Domínio | Descrição |
|---|---|---|---|---|
| `review_id` | `integer` (PK, auto-increment) | Não | Único, sequencial | Identificador único da avaliação. |
| `tmdb_id` | `integer` (FK → `movies.tmdb_id`) | Não | Deve existir na base de filmes | ID do filme conforme *The Movie Database*, evitando recadastro de filmes. |
| `user_id` | `integer` (FK → `users.user_id`) | Não | Deve existir na base de usuários | Autor da avaliação. |
| `rating_public` | `decimal(2,1)` | Não | `0.0 ≤ x ≤ 5.0`, incrementos de `0.5` | Nota pública, visível a todos. |
| `rating_personal_specific` | `decimal` | Sim | Sem mínimo/máximo definido | Nota pessoal do usuário, não exibida publicamente. |
| `is_cinema` | `boolean` | Sim | `true` / `false` | Indica se foi assistido no cinema. |
| `date_watched` | `date` | Sim | `≤ date_rating` | Data em que o filme foi assistido. |
| `comment` | `varchar(256)` | Não* | Máx. 256 caracteres | Comentário sobre o filme. *Definir se string vazia é permitida. |
| `contains_spoilers` | `boolean` | Não | Default `false` | Sinaliza se o comentário contém spoilers. |
| `created_at` | `datetime` | Não | Auto | Data de criação do registro. |
| `updated_at` | `datetime` | Não | Auto | Última edição da review. |

---

### Tabela: `review_watchers` (substitui `watched_with`)

| Campo | Tipo | Nulo? | Restrições / Domínio | Descrição |
|---|---|---|---|---|
| `review_id` | `integer` (FK → `reviews.review_id`) | Não | — | Review à qual o acompanhante se refere. |
| `user_id` | `integer` (FK → `users.user_id`) | Não | — | Usuário que assistiu junto. |

> Chave primária composta: `(review_id, user_id)`. Guardar `user_id` em vez de `username` evita quebra de referência caso o usuário troque o nome de exibição.

---

## 3. Entidade de apoio: `Movie` (cache do TMDB)

| Campo | Tipo | Nulo? | Restrições / Domínio | Descrição |
|---|---|---|---|---|
| `tmdb_id` | `integer` (PK) | Não | Único | ID original do TMDB. |
| `title` | `varchar(255)` | Não | — | Título do filme. |
| `release_date` | `date` | Sim | — | Data de lançamento (fonte da verdade, substitui `date_movie_release` em `reviews`). |
| `poster_url` | `varchar(512)` | Sim | — | Capa do filme. |
| `genres` | `array<string>` | Sim | — | Gêneros conforme TMDB. |
| `synced_at` | `datetime` | Não | Auto | Última sincronização com a API do TMDB. |

---