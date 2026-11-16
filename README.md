# E-commerce REST API

Node.js · Express 5 · MongoDB/Mongoose · JWT · Joi

Modules: **User management**, **multi-level categories**, **products**, **orders** — with role-based
access (`admin`, `customer`), centralized error handling, request validation, rate limiting and
request logging.

## Quick start

### Option A – Docker (recommended; MongoDB runs as a replica set so transactions work)
```bash
cp .env.example .env            # optional, set JWT_SECRET / ADMIN_* for docker-compose
docker compose up --build
docker compose exec api node src/scripts/seedAdmin.js   # create the admin user
```
API: http://localhost:3000/api/v1 · Swagger UI: http://localhost:3000/api-docs

### Option B – Local
Requires Node 18+ and MongoDB.
```bash
npm install
cp .env.example .env            # edit JWT_SECRET (and MONGO_URI if needed)
npm run seed:admin              # creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                     # or: npm start
```
With a standalone `mongod` keep `USE_TRANSACTIONS=false`. With a replica set / Atlas set
`USE_TRANSACTIONS=true` (see "Stock handling").

## Scripts
| Command | Purpose |
|---|---|
| `npm start` / `npm run dev` | Run the API (dev uses nodemon) |
| `npm run seed:admin` | Create the first admin user |
| `npm test` | Unit + integration tests (integration spins up an in-memory MongoDB replica set) |
| `npm run test:unit` | Unit tests only (no database needed) |

## Documentation
* Swagger UI at `/api-docs`; the spec is `src/docs/openapi.yaml`.
* **Postman:** *Import → File →* `src/docs/openapi.yaml` (or the URL of the spec) generates a full collection.
  Set a collection-level Bearer token from `POST /auth/login`.

## Project structure
```
src/
  config/        env (validated at boot), db connection, constants (roles, statuses, transitions)
  models/        User, Category, Product, Order (+ indexes)
  validators/    Joi schemas per module
  middleware/    auth (authenticate/authorize), validate, errorHandler, rateLimiter
  services/      business logic (no req/res)
  controllers/   thin HTTP layer
  routes/        route + middleware wiring
  utils/         ApiError, jwt, pagination, transaction helper, helpers
  scripts/       seedAdmin
  docs/          openapi.yaml
tests/           unit + integration (supertest + mongodb-memory-server)
```
Request flow: `route → validate → authenticate/authorize → controller → service → model`.
Express 5 forwards async errors automatically, so controllers have no try/catch;
everything ends up in the central `errorHandler`.

## Endpoints (prefix `/api/v1`)
| Area | Endpoint | Access |
|---|---|---|
| Auth | `POST /auth/register`, `POST /auth/login` | public |
| Users | `GET/PATCH /users/me`, `PATCH /users/me/password` | authenticated |
| | `GET /users`, `GET /users/:id`, `PATCH /users/:id/status` | admin |
| Categories | `GET /categories/tree` | public |
| | `POST/GET /categories`, `GET/PATCH/DELETE /categories/:id` | admin |
| Products | `GET /products`, `GET /products/:id` (active only) | public |
| | `POST /products`, `PATCH/DELETE /products/:id`, `GET /products/admin/list`, `GET /products/admin/:id` | admin |
| Orders | `POST /orders` | customer |
| | `GET /orders` (own for customers, all for admin), `GET /orders/:id` | authenticated |
| | `PATCH /orders/:id/cancel` | customer (own, Pending only) |
| | `PATCH /orders/:id/status` | admin |

Product listing query params: `search`, `category`, `minPrice`, `maxPrice`, `sort`
(`newest|oldest|price_asc|price_desc|name_asc|name_desc`), `page`, `limit`.

Responses: `{ success, message?, data, pagination? }`; errors: `{ success:false, message, errors? }`.

## Design decisions

### Multi-level categories
Each category stores `parent` **and** a materialised `ancestors` path (root → parent).
* **Unlimited depth**, no recursion in queries.
* **All descendants** of a category: `find({ ancestors: id })` – one indexed query. This powers
  "filter by parent category includes all sub-categories" for products.
* **Tree API**: one query loads all categories; the tree is assembled in memory in O(n).
* **Invalid relationships rejected (400)**: self-parent, and moving a category under one of its own
  descendants (`newParent.ancestors` contains the category). Missing parent → 404.
* **Moving a subtree** rewrites the descendants' `ancestors` (in a transaction when enabled).
* Sibling names are unique (`{parent, slug}` unique index). Deleting a category that has
  children or products returns 409.

### Products
`effectivePrice` (= `salePrice ?? price`) is stored so price filtering/sorting uses a plain index
and filters on what the customer actually pays. `salePrice <= price` is enforced. Search is a
case-insensitive, regex-escaped match on name/SKU/description (supports partial words; for very
large catalogues swap for a MongoDB text/Atlas Search index).

### Orders & stock handling
* Client sends only `productId` + `quantity`; **name, SKU, unit price and total are computed on the
  server** and snapshotted into the order.
* Each stock decrement is a single atomic `findOneAndUpdate({stock: {$gte: qty}}, {$inc: {stock: -qty}})`
  so concurrent orders cannot oversell.
* `USE_TRANSACTIONS=true`: the whole order (all decrements + order insert) is one MongoDB
  transaction – all or nothing. `false` (standalone Mongo): same atomic updates, and stock is
  restored by a compensating action if a later line fails.
* Status flow: `Pending → Confirmed → Processing → Shipped → Delivered`; `Cancelled` is allowed until
  Shipped. Invalid transitions return 409. Cancelling restores stock; the status change is a
  compare-and-set, so a double-cancel can't restore stock twice. Customers can cancel their own
  *Pending* orders.
* Other customers' orders return **404** (not 403) so ids cannot be probed.

### Security
bcrypt password hashing (never returned; `select:false`), JWT with expiry, token invalidated after a
password change, deactivated users are blocked on every request (not only at login), public
registration can only create customers, Joi `stripUnknown` prevents mass-assignment, `helmet`, CORS,
body size limit, global + stricter auth rate limiting, secrets only via environment variables.

### Indexes
`User(email unique, role+isActive)`, `Category(parent+slug unique, ancestors)`,
`Product(sku unique, category+status+effectivePrice, status+createdAt, name)`,
`Order(orderNumber unique, user+createdAt, status+createdAt)`.

## Assumptions / possible extensions
* Admin accounts are created with `npm run seed:admin` (not via public registration).
* Single currency, no payment gateway, no cart; refresh tokens and email verification omitted.
* Products are hard-deleted; orders keep their own snapshot of name/SKU/price.
