# Backend — Web3 Platform API

Express.js + TypeScript REST API for the Web3 Platform (Phase 1): auth, wallet linking,
token records, transaction history, notifications, and admin management.

## Stack

- **Express 4** + TypeScript, run via `ts-node-dev` in dev / compiled with `tsc` for prod.
- **SQLite** (via the `sqlite`/`sqlite3` packages) is the database — see [Database](#database) below.
- **JWT** access + refresh tokens, both delivered as httpOnly cookies (see [Auth](#auth)).
- **zod** for request-body validation.
- **swagger-jsdoc** + **swagger-ui-express** for API docs, generated from `@openapi` blocks
  above each route in `src/routes/*.ts`.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in JWT_SECRET / REFRESH_SECRET — see below
npm run dev            # ts-node-dev, auto-restarts on change
```

The server refuses to start unless `JWT_SECRET` and `REFRESH_SECRET` are set — there is no
insecure built-in fallback. Generate real values with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Use two different values for the two secrets. See `.env.example` for every variable and
what it does, including the default-admin-seeding behavior (`ADMIN_EMAIL`/`ADMIN_PASSWORD`).

Once running:
- API: `http://localhost:5000/api`
- Swagger UI: `http://localhost:5000/api/docs`
- Health check: `GET /api/health`

## Database

The code connects to a local **SQLite** file (`backend/web3_db.sqlite`, created
automatically on first run) via a small `pool.query(text, params)` shim in
`src/config/db.ts` that mimics the shape of a `pg` Pool — so the model layer
(`src/models/*.ts`) reads like plain parameterized SQL regardless of the underlying driver.

`docker-compose.yml` at the repo root provisions a Postgres container; it isn't wired up
to anything yet and exists for a future migration if/when the project needs concurrent
writers, replication, or Postgres-specific features. Until then, SQLite is intentionally
simpler for local development — no `docker compose up` required to run the backend.

Table schemas are created idempotently in `src/config/initDb.ts` on every server start.

## Auth

Login/register/refresh issue **two httpOnly cookies**:

| Cookie         | Lifetime | Purpose                                   |
|----------------|----------|--------------------------------------------|
| `accessToken`  | 15 min   | Sent on every request; verified by `authenticateJWT` |
| `refreshToken` | 7 days   | Used only by `POST /auth/refresh` to mint a new pair |

Neither token is ever returned in a JSON response body or read by client-side JS — this
closes off token theft via XSS (a vulnerability that would otherwise exist if a token were
kept in `localStorage`). The frontend calls the API with `withCredentials: true` and never
touches a token directly.

Cookies are `sameSite: 'strict'` and `secure` in production. `sameSite: 'strict'` still
allows the cookie between `localhost:5173` (frontend) and `localhost:5000` (backend) in
dev, since both share the same registrable domain (`localhost`) — only the port differs.

`POST /auth/logout` revokes the stored refresh token server-side and clears both cookies.

### RBAC

`authorize('admin')` (and similar) gates routes after `authenticateJWT`. Roles are
`'user' | 'admin' | 'moderator'` (see `src/models/user.model.ts`); only `'admin'` currently
has dedicated routes gated behind it (`/api/admin/*`, `/api/tokens/admin`,
`/api/transactions/admin`) — `'moderator'` is a reserved role for future use.

## Security

- **Headers**: `helmet` is mounted on every request (`src/app.ts`) — `X-Content-Type-Options`,
  frame-ancestors denial, etc. Content-Security-Policy is explicitly disabled, since Swagger
  UI is mounted on this same app at `/api/docs` and needs inline styles/scripts to render;
  every other helmet protection still applies.
- **Rate limiting**: `authLimiter` (register/login), `refreshLimiter`, and `adminMutationLimiter`
  target specific sensitive routes; `apiLimiter` (`src/middleware/rateLimit.middleware.ts`) is
  mounted globally as a loose fallback (300 req/15 min/IP) so routes that previously had no
  limiting at all (tokens, transactions, notifications) aren't wide open to flooding. All of
  them no-op under `NODE_ENV=test` — see the comment in that file for why.
- **Body size limit**: `express.json({ limit: '100kb' })` — an oversized request is rejected
  with `413` before it ever reaches a controller.
- **CSRF posture**: relies on `sameSite: 'strict'` cookies (see [Auth](#auth)) rather than a
  separate CSRF token — a strict-samesite cookie is never attached to a cross-site request in
  the first place, which covers the standard CSRF attack shape for this app's scope.
- **Secret strength**: `src/config/env.ts` warns at startup (doesn't fail) if `JWT_SECRET`/
  `REFRESH_SECRET` are under 32 characters.
- **Audit logging**: failed login attempts and admin role-change/delete actions are logged
  server-side (`console.warn('[Security] ...')`) — a lightweight trail, not a separate service.

## Analytics

`GET /admin/analytics?days=14` (admin only) returns day-by-day signup/token/transaction
counts for the last N days (`days` clamped to 1–90) plus the top 5 token creators —
see `src/utils/analytics.ts` for the shared day-grouping query reused across all three
series, and `getTopTokenCreators` in `src/models/token.model.ts`.

## Error handling

Controllers throw `AppError(statusCode, message)` (`src/utils/AppError.ts`) for expected,
client-facing failures (bad input, not found, conflict, etc.). Known library-thrown HTTP
errors (e.g. body-parser's `413` when a request exceeds the size limit) keep their own
status code too. Everything else — a genuine bug, a DB failure — falls through to the
central `errorHandler` (`src/middleware/error.middleware.ts`) as a generic
`500 Internal server error`, so no stack trace or internal detail ever reaches a client.
Controllers are wrapped in `asyncHandler` (`src/utils/asyncHandler.ts`) so a rejected
promise reaches that handler instead of crashing the process.

Request bodies are validated with zod schemas (`src/validation/schemas.ts`) via the
`validateBody` middleware, applied per-route in `src/routes/*.ts`, before the controller
ever runs.

## Testing

```bash
npm test
```

Jest + Supertest, run against an isolated in-memory SQLite database (see
`tests/testDb.ts`) — no test ever touches `web3_db.sqlite`. Coverage: auth middleware
(token verification, role gating); integration tests through the full auth flow
(register/login/refresh/logout/link-wallet/unlink-wallet), admin user management and
analytics, token/transaction/notification recording; and the security middleware
(headers present, oversized bodies rejected).

## Project layout

```
src/
  config/       env loading, DB connection + transactions, DB schema init, Swagger spec
  middleware/   JWT auth, RBAC, rate limiting, zod validation, central error handler
  validation/   zod request-body schemas
  models/       parameterized SQL per table (users, tokens, transactions, notifications)
  controllers/  route handlers — thin, delegate to models, throw AppError on failure
  routes/       Express routers + @openapi JSDoc documentation
  utils/        AppError, asyncHandler, sanitizeUser, pagination helper
```
