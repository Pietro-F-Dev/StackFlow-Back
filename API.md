# StockFlow — API Reference

Base URL: `http://localhost:3001/api`

Todos os valores monetários são em **centavos inteiros** (ex: R$ 25,00 → `2500`).

---

## Autenticação

A API usa **JWT Bearer Token**. Após o login, inclua o header em todas as requisições protegidas:

```
Authorization: Bearer <token>
```

O token expira em **7 dias**.

### Roles

| Role    | Permissões                                      |
|---------|-------------------------------------------------|
| `admin` | Acesso total                                    |
| `seller`| Leitura de produtos/estoque, criar vendas       |

---

## Endpoints

### Auth

#### `POST /auth/login`
Autentica um usuário. Rate limit: 10 tentativas por 15 minutos.

**Body**
```json
{
  "email": "admin@stockflow.com",
  "password": "admin123"
}
```

**Response 200**
```json
{
  "token": "eyJhbGci...",
  "refreshToken": "f9R4...base64url",
  "user": { "id": "...", "name": "Admin", "email": "admin@stockflow.com", "role": "admin" }
}
```

> `token` é um JWT de curta duração (default 1h). Use `refreshToken` para obter um novo par via `POST /auth/refresh`.

---

#### `POST /auth/refresh`
Troca um refresh token válido por um novo par `{ token, refreshToken }`. O refresh token antigo é invalidado (rotation). Rate limit: 10/15min.

**Body**
```json
{ "refreshToken": "f9R4...base64url" }
```

**Response 200**
```json
{
  "token": "eyJhbGci...",
  "refreshToken": "Xz8q...base64url"
}
```

**Erros**
| Code                    | Status | Descrição                          |
|-------------------------|--------|------------------------------------|
| `INVALID_REFRESH_TOKEN` | 401    | Token inválido, expirado ou já usado |

---

#### `POST /auth/logout`
Revoga o refresh token (efetivamente desloga o cliente). O access token continua válido até expirar (curto TTL).

**Body**
```json
{ "refreshToken": "f9R4...base64url" }
```

**Response 204** — sem corpo.

---

#### `POST /auth/register` — `admin`
Cria um novo usuário.

**Body**
```json
{
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "password": "senha1234",
  "role": "seller"
}
```

**Response 201** — objeto do usuário criado (sem senha).

---

### Produtos

Todas as rotas exigem autenticação. Mutações (`POST`, `PUT`, `DELETE`) exigem role `admin`.

#### `GET /products`
Lista produtos paginados.

**Query params**
| Param      | Tipo    | Default | Descrição                        |
|------------|---------|---------|----------------------------------|
| `page`     | number  | 1       |                                  |
| `limit`    | number  | 10      | Máx 50                           |
| `active`   | boolean | true    | `false` retorna inativados       |
| `category` | string  | —       | Filtra por categoria             |
| `search`   | string  | —       | Busca por nome ou SKU (fulltext) |

**Response 200**
```json
{
  "data": [...],
  "page": 1,
  "limit": 10,
  "total": 42,
  "totalPages": 5
}
```

---

#### `GET /products/low-stock`
Lista produtos ativos com `quantity <= minStock`.

**Response 200**
```json
{ "data": [...] }
```

---

#### `GET /products/:id`
Retorna um produto pelo ID.

---

#### `POST /products` — `admin`
Cria um produto.

**Body**
```json
{
  "name": "Notebook Dell",
  "sku": "NB-DELL-001",
  "category": "Eletrônicos",
  "costPrice": 250000,
  "salePrice": 350000,
  "quantity": 10,
  "minStock": 2
}
```

> SKU é normalizado automaticamente para maiúsculas.

**Response 201** — objeto do produto criado.

---

#### `PUT /products/:id` — `admin`
Atualiza um produto. Todos os campos são opcionais.

**Response 200** — produto atualizado.

---

#### `DELETE /products/:id` — `admin`
Soft delete — marca `active: false`. Histórico de vendas preservado.

**Response 204**

---

### Estoque

#### `POST /stock/movements` — `admin`
Cria um movimento de estoque manual.

**Body**
```json
{
  "productId": "664a1b2c3d4e5f6a7b8c9d0e",
  "type": "in",
  "qty": 50,
  "reason": "Reposição de fornecedor"
}
```

| Campo       | Valores                      |
|-------------|------------------------------|
| `type`      | `in`, `out`, `adjustment`    |
| `qty`       | Inteiro não-zero. Negativo para saída |

> Movimentos do tipo `sale` são criados automaticamente pela rota de vendas.

**Response 201** — objeto do movimento criado.

---

#### `GET /stock/movements`
Lista movimentos paginados.

**Query params**
| Param       | Tipo   | Descrição               |
|-------------|--------|-------------------------|
| `productId` | string | Filtra por produto      |
| `type`      | string | `in`, `out`, `sale`, `adjustment` |
| `from`      | date   | Data início (ISO 8601)  |
| `to`        | date   | Data fim (ISO 8601)     |
| `page`      | number | Default 1               |
| `limit`     | number | Default 10, máx 50      |

---

### Vendas

#### `POST /sales`
Cria uma venda. Decrementa estoque atomicamente via transação MongoDB.

**Body**
```json
{
  "items": [
    { "productId": "664a1b2c3d4e5f6a7b8c9d0e", "qty": 2 },
    { "productId": "664a1b2c3d4e5f6a7b8c9d1f", "qty": 1 }
  ],
  "discountCents": 500,
  "taxCents": 200,
  "shippingCents": 1500,
  "notes": "Entrega expressa"
}
```

| Campo            | Tipo   | Default | Descrição                                                |
|------------------|--------|---------|----------------------------------------------------------|
| `discountCents`  | number | 0       | Desconto em centavos. Truncado em `grossTotal`.          |
| `taxCents`       | number | 0       | Taxa em centavos. Somada ao `totalPaid`.                 |
| `shippingCents`  | number | 0       | Frete em centavos. Somado ao `totalPaid`.                |
| `notes`          | string | —       | Observação livre (máx 500 chars).                        |

**Response 201**
```json
{
  "_id": "...",
  "date": "2026-06-10T14:00:00.000Z",
  "userId": "...",
  "grossTotal": 7500,
  "netTotal": 4000,
  "discountCents": 500,
  "taxCents": 200,
  "shippingCents": 1500,
  "totalPaid": 8700,
  "notes": "Entrega expressa",
  "items": [
    {
      "productId": "...",
      "name": "Produto A",
      "qty": 2,
      "unitPrice": 2500,
      "unitCost": 1000
    }
  ]
}
```

> `name`, `unitPrice` e `unitCost` são snapshots do momento da venda.
>
> **Fórmulas:**
> - `totalPaid = grossTotal − discountCents + taxCents + shippingCents`
> - `netTotal = Σ(qty × (unitPrice − unitCost)) − discountCents`
>
> O lucro (`netTotal`) absorve o desconto; taxa e frete são pass-through. Relatórios mensais continuam usando `grossTotal` como base de `grossRevenue` para não distorcer faturamento de produto com taxa/frete.

**Erros possíveis**
| Code                | Status | Descrição                          |
|---------------------|--------|------------------------------------|
| `PRODUCT_NOT_FOUND` | 422    | Produto não encontrado ou inativo  |
| `INSUFFICIENT_STOCK`| 422    | Estoque insuficiente               |

---

#### `GET /sales`
Lista vendas paginadas.

**Query params**
| Param   | Tipo   | Descrição              |
|---------|--------|------------------------|
| `from`  | date   | Data início (ISO 8601) |
| `to`    | date   | Data fim (ISO 8601)    |
| `page`  | number | Default 1              |
| `limit` | number | Default 10, máx 50     |

---

#### `GET /sales/:id`
Retorna uma venda pelo ID.

---

### Relatórios

#### `GET /reports/monthly?year=2026&month=6`
Retorna o relatório mensal agregado.

**Response 200**
```json
{
  "year": 2026,
  "month": 6,
  "grossRevenue": 150000,
  "netRevenue": 75000,
  "salesCount": 12,
  "itemsSold": 34,
  "topProducts": [
    { "productId": "...", "name": "Produto A", "qtySold": 15, "grossRevenue": 75000 }
  ],
  "dailySeries": [
    { "day": 1, "grossRevenue": 10000, "netRevenue": 5000 },
    { "day": 2, "grossRevenue": 0, "netRevenue": 0 }
  ]
}
```

---

#### `GET /reports/monthly/export?year=2026&month=6&format=csv`
Exporta o relatório.

**Query params**
| Param    | Valores       | Default |
|----------|---------------|---------|
| `year`   | number        | —       |
| `month`  | number (1–12) | —       |
| `format` | `csv`, `pdf`  | `csv`   |

- **CSV**: `Content-Type: text/csv`, com BOM UTF-8 (compatível com Excel)
- **PDF**: `Content-Type: application/pdf`

---

## Respostas de erro

Todos os erros seguem o formato:

```json
{
  "error": "CÓDIGO_DO_ERRO",
  "message": "Descrição legível",
  "data": {}
}
```

| Status | Situação                                     |
|--------|----------------------------------------------|
| 400    | Parâmetro inválido (ex: ID malformado)       |
| 401    | Token ausente ou inválido                    |
| 403    | Role sem permissão                           |
| 404    | Recurso não encontrado                       |
| 409    | Conflito (ex: SKU duplicado)                 |
| 422    | Regra de negócio violada (estoque, etc.)     |
| 429    | Rate limit atingido                          |
| 500    | Erro interno                                 |
