# StockFlow — Backend

API REST para gestão de estoque e vendas em pequenos negócios. Backend em Node.js + TypeScript com MongoDB, autenticação JWT com refresh tokens, controle de acesso por papel (admin/seller) e geração de relatórios mensais em CSV e PDF.

> **Frontend complementar:** [StackFlow-Front](https://github.com/Pietro-F-Dev/StackFlow-Front)

---

## Sumário

- [Stack](#stack)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Setup](#setup)
- [Scripts](#scripts)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [API](#api)
- [Autenticação e autorização](#autenticação-e-autorização)
- [Segurança](#segurança)
- [Testes](#testes)
- [Deploy](#deploy)
- [Licença](#licença)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 20+ |
| Linguagem | TypeScript 5 (`strict: true`) |
| HTTP | Express 4 |
| Banco | MongoDB 7 (replica set para transações) com Mongoose 8 |
| Auth | JWT (HS256) + refresh tokens com rotation |
| Validação | Zod |
| Segurança | Helmet, CORS, express-rate-limit, bcryptjs |
| PDF | PDFKit |
| Testes | Jest + Supertest + mongodb-memory-server |
| Lint / Format | ESLint + Prettier |

---

## Funcionalidades

- **Auth completo** — login, refresh, logout, register (admin-only)
- **Produtos** — CRUD com soft delete, busca full-text por nome/SKU, filtro por categoria, listagem de baixo estoque
- **Vendas** — criação transacional, snapshot de preço/custo no momento da venda, suporte a desconto, taxa, frete e notas, cálculo automático de `totalPaid` e lucro
- **Movimentações de estoque** — entrada, saída, ajuste manual; movimentações de venda criadas automaticamente
- **Relatórios mensais** — receita bruta, líquida, vendas, itens vendidos, top produtos e série diária; exportação CSV e PDF
- **Controle de concorrência** — transações Mongo com retry em `TransientTransactionError`; estoque nunca fica negativo
- **Rate limiting** — em `/auth/login` e `/auth/refresh` (10 tentativas / 15 min)

---

## Arquitetura

Camadas separadas: **routes → controllers → services → models**.

- **routes** — montam o pipeline de middlewares (auth, role, validate) e mapeiam pra controllers
- **controllers** — parseiam request, chamam o service, devolvem resposta. Sem lógica de negócio
- **services** — lógica de negócio pura. Transações, regras, cálculos
- **models** — schemas Mongoose com índices e validators
- **middlewares** — auth, requireRole, validate, rateLimiter, errorHandler, asyncHandler, sanitizeQuery
- **utils** — paginação, range de datas, transação Mongo, helpers de auth
- **constants** — `ROLES` enum como única fonte de verdade pra strings de papel

A camada de **service** é independente do Express, facilitando testes unitários e reuso.

---

## Estrutura do projeto

```
src/
├── app.ts                     # Express app + middlewares globais
├── server.ts                  # Bootstrap (DB connect + listen)
├── config/
│   ├── env.ts                 # Carregamento + validação de env vars
│   └── db.ts                  # Conexão com Mongo
├── constants/
│   └── roles.ts               # ROLES.ADMIN / ROLES.SELLER
├── controllers/               # Camada HTTP
├── services/                  # Lógica de negócio
├── models/                    # Mongoose schemas
├── routes/                    # Definição das rotas
├── schemas/                   # Zod schemas (validação de input)
├── middlewares/
│   ├── auth.ts                # Verifica JWT, popula req.user
│   ├── requireRole.ts         # Autorização por papel
│   ├── validate.ts            # Zod → req.body
│   ├── rateLimiter.ts         # express-rate-limit configurado
│   ├── sanitizeQuery.ts       # Defesa contra NoSQL operator injection
│   ├── asyncHandler.ts        # try/catch para handlers async
│   └── errorHandler.ts        # Handler global + AppError
├── utils/
│   ├── pagination.ts          # parsePagination + buildPaginatedResult
│   ├── dateRange.ts           # parseDateRange (with validation)
│   ├── authUser.ts            # getAuthUser(req) — type-safe req.user
│   └── withTransaction.ts     # Wrapper de transação Mongo com retry
└── types/
    └── express.d.ts           # Extensão do tipo Request

scripts/
└── seed.ts                    # Seed de produtos + usuários demo (dev-only)

tests/
├── auth.test.ts               # Login, refresh, register
├── product.test.ts            # CRUD de produtos
├── sale.test.ts               # Venda (happy path, estoque, extras)
├── report.test.ts             # Relatório mensal
├── dbSetup.ts                 # MongoMemoryReplSet
├── env.setup.ts               # Env vars para testes
└── helpers.ts                 # createTestUser, generateToken, etc.
```

---

## Pré-requisitos

- **Node.js** 20 ou superior
- **MongoDB** 7+ em **replica set** (necessário para transações)
  - Local: instale o Mongo e rode com `mongod --replSet rs0` + `rs.initiate()` no shell, ou
  - **Recomendado:** use o [MongoDB Atlas](https://www.mongodb.com/atlas) free tier

---

## Setup

```bash
# 1. Clonar e instalar
git clone https://github.com/Pietro-F-Dev/StackFlow-Back.git
cd StackFlow-Back
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# edite .env com seus valores reais (MONGODB_URI e JWT_SECRET são obrigatórios)

# 3. Popular o banco com dados de exemplo (dev apenas)
npm run seed

# 4. Subir em modo desenvolvimento (tsx watch)
npm run dev
```

Servidor sobe em `http://localhost:3001`. Health check em `GET /health`.

---

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Sobe em modo watch (tsx) |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm start` | Roda `dist/server.js` (produção) |
| `npm run seed` | Popula o banco com usuários demo + produtos |
| `npm test` | Roda os testes (Jest, série) |
| `npm run test:coverage` | Roda os testes com cobertura |
| `npm run lint` | ESLint em `src/` |
| `npm run format` | Prettier em `src/` e `scripts/` |

---

## Variáveis de ambiente

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `PORT` | não | `3001` | Porta HTTP |
| `MONGODB_URI` | **sim** | — | Connection string do Mongo (com replica set) |
| `JWT_SECRET` | **sim** | — | Secret HS256 do JWT. **Mínimo 32 caracteres** (validado no boot) |
| `JWT_EXPIRES_IN` | não | `1h` | TTL do access token (formato `jsonwebtoken`) |
| `REFRESH_TOKEN_TTL_DAYS` | não | `30` | TTL do refresh token em dias |
| `NODE_ENV` | não | `development` | `production` aplica fail-safes (ver Segurança) |
| `ALLOWED_ORIGIN` | em prod | — | URL do frontend para CORS. **Obrigatória se `NODE_ENV=production`** |
| `TRUST_PROXY` | recomendado em prod | — | Número de hops do proxy (`1` para Render/Heroku) ou nome (`loopback`) |
| `DNS_SERVERS` | opcional | — | DNS customizado (lista CSV) — útil se a rede bloqueia SRV do Atlas |

> **Gerar `JWT_SECRET`:** `openssl rand -base64 48` ou `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`

---

## API

Base URL: `/api`

Documentação completa de cada endpoint (body, query, responses, exemplos) em [API.md](./API.md).

### Resumo

#### Auth — `/api/auth`

| Método | Path | Auth | Descrição |
|---|---|---|---|
| POST | `/login` | público | Login (rate-limited) |
| POST | `/refresh` | público | Troca refresh por novo par de tokens |
| POST | `/logout` | público | Revoga o refresh token |
| POST | `/register` | admin | Cria novo usuário |

#### Produtos — `/api/products`

| Método | Path | Auth | Descrição |
|---|---|---|---|
| GET | `/` | autenticado | Lista (paginada, com busca/categoria) |
| GET | `/low-stock` | autenticado | Produtos com `quantity ≤ minStock` |
| GET | `/:id` | autenticado | Detalhe |
| POST | `/` | admin | Cria |
| PUT | `/:id` | admin | Atualiza |
| DELETE | `/:id` | admin | Soft delete (marca `active: false`) |

#### Vendas — `/api/sales`

| Método | Path | Auth | Descrição |
|---|---|---|---|
| POST | `/` | autenticado | Cria venda (transação atômica) |
| GET | `/` | autenticado | Lista (sellers veem só as próprias) |
| GET | `/:id` | autenticado | Detalhe (sellers só do dono) |

#### Estoque — `/api/stock`

| Método | Path | Auth | Descrição |
|---|---|---|---|
| POST | `/movements` | admin | Movimentação manual (entrada/saída/ajuste) |
| GET | `/movements` | admin | Lista de movimentações |

#### Relatórios — `/api/reports`

| Método | Path | Auth | Descrição |
|---|---|---|---|
| GET | `/monthly?year=&month=` | admin | JSON com sumário, top produtos e série diária |
| GET | `/monthly/export?year=&month=&format=csv\|pdf` | admin | Download CSV ou PDF |

### Formato padrão

**Paginação:**

```json
{
  "data": [...],
  "page": 1,
  "limit": 10,
  "total": 42,
  "totalPages": 5
}
```

**Erro:**

```json
{ "error": "CODE_EM_CAIXA_ALTA", "message": "mensagem humana", "details": {...} }
```

| Status | Códigos comuns |
|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_DATE`, `INVALID_ID`, `MALFORMED_JSON` |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `INVALID_REFRESH_TOKEN` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `EMAIL_TAKEN`, `SKU_CONFLICT` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 422 | `INSUFFICIENT_STOCK`, `NEGATIVE_STOCK`, `PRODUCT_NOT_FOUND` |
| 429 | `TOO_MANY_REQUESTS` |
| 500 | `INTERNAL_ERROR` |

---

## Autenticação e autorização

### Fluxo

1. **Login** retorna `{ token, refreshToken, user }`.
   - `token` (JWT HS256) — TTL curto (default `1h`). Envia em `Authorization: Bearer <token>`.
   - `refreshToken` — opaco, 48 bytes aleatórios em base64url. Persistir no client.
2. Quando o `token` expira → cliente chama `POST /auth/refresh` com o `refreshToken`.
3. O backend **invalida o refresh antigo** (rotation) e emite um novo par. Replay do antigo retorna 401.
4. **Logout** chama `POST /auth/logout` com o `refreshToken` para revogar imediatamente. O access token continua válido até expirar naturalmente (TTL curto minimiza a janela).

### Armazenamento

- **Refresh tokens são guardados como SHA-256** no Mongo (`tokenHash`). Se o banco vazar, o atacante não consegue trocar pelo par novo.
- TTL index do Mongo expira documentos automaticamente após `expiresAt`.

### Papéis

- `admin` — acesso total
- `seller` — pode criar vendas, ler produtos e ler **apenas as próprias vendas**

Regras aplicadas via `requireRole(...)` nas routes ou checagem de ownership nos services (`role !== ROLES.ADMIN && sale.userId !== userId`).

---

## Segurança

Lista do que está em produção (auditoria registrada no projeto, sem dependências vulneráveis em `npm audit`):

- **JWT** verificado com `algorithms: ['HS256']` explícito (defesa contra algorithm confusion)
- **`JWT_SECRET` ≥ 32 chars** validado no boot
- **CORS strict em produção** — refusa subir se `ALLOWED_ORIGIN` não estiver setada
- **Helmet** com defaults (CSP/HSTS/etc.)
- **Rate limit** em `/auth/login` e `/auth/refresh`
- **bcrypt** com `SALT_ROUNDS=10` + dummy hash compare em login para evitar timing attack / user enumeration
- **Senha** com complexidade mínima (8 chars, letra + dígito, cap em 72 bytes do bcrypt)
- **Sanitização contra NoSQL operator injection** — todos os filtros user-controlled passam por `asScalarString` + validação por whitelist (ObjectId, enum)
- **Body size limit** de 10 KB no `express.json`
- **Trust proxy** configurável via `TRUST_PROXY` (necessário atrás de LB/CDN para rate limiting funcionar)
- **DNS customizado** opt-in via `DNS_SERVERS` (não força Google DNS por padrão)
- **Refresh token rotation** — token antigo é invalidado a cada refresh; replay = 401
- **Seed bloqueado em produção** — `npm run seed` falha se `NODE_ENV=production`
- **Erros não vazam stack** — `errorHandler` retorna mensagens genéricas; stack vai pro log servidor
- **Soft delete** em produtos (mantém histórico de vendas)

---

## Testes

```bash
npm test               # roda toda a suíte
npm run test:coverage  # com relatório de cobertura
```

Os testes sobem um **MongoDB in-memory replica set** (`mongodb-memory-server`) — não exigem banco rodando. Cada `beforeEach` limpa o estado.

Coberturas relevantes:
- Auth — login, refresh rotation, logout, register por admin, 401/403
- Produtos — CRUD, SKU conflict, search, low-stock
- Vendas — happy path, snapshot de preço, estoque insuficiente, extras (desconto/taxa/frete), clamp de desconto
- Estoque — movimentação manual, ajuste para negativo bloqueado, autorização
- Relatórios — sumário mensal, top produtos, série diária

---

## Deploy

### Render / Railway / Fly.io

1. Setar todas as variáveis obrigatórias (`MONGODB_URI`, `JWT_SECRET`, `ALLOWED_ORIGIN`, `NODE_ENV=production`)
2. Setar `TRUST_PROXY=1` (ou o número de hops da plataforma)
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Garantir que o cluster Mongo tem **replica set** habilitado (Atlas habilita por padrão)

### Checklist de produção

- [ ] `JWT_SECRET` ≥ 32 chars, alta entropia
- [ ] `ALLOWED_ORIGIN` apontando para o domínio do frontend
- [ ] `TRUST_PROXY` configurado
- [ ] `MONGODB_URI` com TLS (`?ssl=true&authSource=admin&retryWrites=true&w=majority`)
- [ ] Não rodar `npm run seed` em prod (bloqueado, mas evite por garantia)
- [ ] Monitorar `console.error` (errorHandler) — vai pro stdout

---

## Licença

MIT — veja [LICENSE](./LICENSE).
