# E-commerce REST API

Node.js · Express 5 · MongoDB/Mongoose · JWT · Joi

Modules: user management, multi-level categories, products and orders, with role-based access
(`admin`, `customer`), request validation, centralized error handling, rate limiting and request logging.

## Setup

### Docker (recommended)
MongoDB runs as a replica set, so transactions work.
```bash
cp .env.example .env
docker compose up --build
docker compose exec api node src/scripts/seedAdmin.js   # create the admin user
```

### Local
Requires Node 18+ and MongoDB.
```bash
npm install
cp .env.example .env        # set JWT_SECRET (and MONGO_URI if needed)
npm run seed:admin          # creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                 # or: npm start
```
Use `USE_TRANSACTIONS=false` with a standalone `mongod`, and `true` with a replica set or Atlas.

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

API: `http://localhost:3000/api/v1` · Swagger UI: `http://localhost:3000/api-docs`

## Tests
```bash
npm test            # unit + integration
npm run test:unit   # unit only, no database needed
```
Integration tests use an in-memory MongoDB replica set (`mongodb-memory-server`), so no local
MongoDB or `.env` is needed. The first run downloads a MongoDB binary and may take a minute.

```
tests/
  unit/          logic tests, no database
  integration/   API tests: auth, users, categories, products, orders
  support/       shared test setup and data factories
```

## API docs
Swagger UI at `/api-docs`; the spec is `src/docs/openapi.yaml`.
For Postman: Import → File → `src/docs/openapi.yaml`, then set a Bearer token from `POST /auth/login`.

## Endpoints (prefix `/api/v1`)
| Area | Endpoint | Access |
|---|---|---|
| Auth | `POST /auth/register`, `POST /auth/login` | public |
| Users | `GET/PATCH /users/me`, `PATCH /users/me/password` | authenticated |
| | `GET /users`, `GET /users/:id`, `PATCH /users/:id/status` | admin |
| Categories | `GET /categories/tree` | public |
| | `POST/GET /categories`, `GET/PATCH/DELETE /categories/:id` | admin |
| Products | `GET /products`, `GET /products/:id` | public |
| | `POST /products`, `PATCH/DELETE /products/:id`, `GET /products/admin/list`, `GET /products/admin/:id` | admin |
| Orders | `POST /orders`, `PATCH /orders/:id/cancel` | customer |
| | `GET /orders`, `GET /orders/:id` | authenticated (own orders; admin sees all) |
| | `PATCH /orders/:id/status` | admin |

Product listing params: `search`, `category`, `minPrice`, `maxPrice`, `sort`
(`newest|oldest|price_asc|price_desc|name_asc|name_desc`), `page`, `limit`.

## Project structure
```
src/
  config/        env, db connection, constants
  models/        User, Category, Product, Order
  validators/    Joi schemas
  middleware/    auth, validate, errorHandler, rateLimiter
  services/      business logic
  controllers/   HTTP layer
  routes/        route wiring
  utils/         ApiError, jwt, pagination, transactions
  scripts/       seedAdmin
  docs/          openapi.yaml
```
Request flow: `route → validate → authenticate/authorize → controller → service → model`.

## Design notes
**Categories.** Each category stores its `parent` and an `ancestors` path, so depth is unlimited.
All descendants are found with one indexed query, and the tree is built in memory from a single
query. Self-parenting and moving a category under its own descendant return 400. Deleting a
category that has children or products returns 409.

**Products.** `effectivePrice` (`salePrice ?? price`) is stored, so price filtering and sorting use
a plain index. Filtering by a parent category includes all its subcategories.

**Orders and stock.** The client sends only `productId` and `quantity`; prices and totals are
calculated on the server. Each stock decrement is one atomic update, so concurrent orders cannot
oversell. With `USE_TRANSACTIONS=true` the whole order is a single transaction. Status flow:
`Pending → Confirmed → Processing → Shipped → Delivered`, and `Cancelled` is allowed until Shipped.
Cancelling restores stock exactly once. Other customers' orders return 404.

**Security.** bcrypt password hashing, JWT with expiry, tokens invalidated after a password change,
deactivated users blocked on every request, public registration creates customers only, Joi
`stripUnknown`, `helmet`, CORS, rate limiting, secrets only in environment variables.

## Assumptions
* Admins are created with `npm run seed:admin`, not through public registration.
* Single currency; no payment gateway, cart, refresh tokens or email verification.
* Products are hard-deleted; orders keep a snapshot of name, SKU and price.
