# Getting started

Getting Saldo running locally, from a fresh clone to a signed-in session.

## Prerequisites

- **Node.js 20+** and npm. CI builds on 20.x, and Next.js 16 will not run on 18.
- **Docker and Docker Compose**, unless you are bringing your own PostgreSQL.

## The short version

```bash
npm install               # also runs `prisma generate` via postinstall
docker compose up -d db   # Postgres 16 on localhost:3006
./run-migrations.sh       # prisma migrate deploy
npm run dev               # http://localhost:3000
```

Open http://localhost:3000, choose **Sign up**, and create an account with an email
and password. There is no seeded user in the dev database — the e2e suite seeds its
own, in a different database.

## Setup in full

### 1. Install dependencies

```bash
npm install
```

The `postinstall` script runs `prisma generate`. That matters more here than in most
projects: the Prisma client is generated to `src/generated/prisma`, **not** into
`node_modules`, so a clone that skips install has no client at all and typechecking
fails on imports rather than at runtime.

### 2. Start PostgreSQL

```bash
docker compose up -d db
```

`docker-compose.yml` runs `postgres:16` with database `saldo`, user `postgres`,
password `password`, published on **host port 3006** (container 5432). Nothing in the
compose setup is intended to leave your machine.

Bringing your own PostgreSQL instead is fine — create a database and point
`POSTGRES_PRISMA_URL` at it. The rest of this page assumes the compose one.

### 3. Apply migrations

```bash
./run-migrations.sh
```

The script brings up `db` if it is not already running, then runs `prisma migrate
deploy` against `postgres://postgres:password@localhost:3006/saldo`. It hardcodes that
URL, so it is only useful for the compose database; against your own, run migrations
directly:

```bash
POSTGRES_PRISMA_URL="postgres://user:pass@host:5432/db" npx prisma migrate deploy
```

### 4. Run the app

Two ways, and the difference is where the app process lives:

```bash
npm run dev          # app on your host, database in Docker  ← the usual loop
```

```bash
docker compose up    # app in Docker too, on http://localhost:3000
```

The container path is the one that needs no local Node at all: `dev.Dockerfile`
installs dependencies and starts Next.js inside the container, reaching the database
at `db:5432` rather than `localhost:3006`. It mounts the repository as a volume, so
edits still hot-reload. Day to day, `npm run dev` is faster.

## Environment variables

Everything is read from `.env` in development. The compose file passes the two
database URLs to the app container directly, so a plain compose run needs no `.env`
at all — but `npm run dev` does.

| Variable                             | Required                        | What it does                                                                                         |
| ------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `POSTGRES_PRISMA_URL`                | **always**                      | The connection string Prisma and the runtime both use.                                                 |
| `POSTGRES_URL_NON_POOLING`           | for `prisma migrate dev`        | Shadow database URL (`prisma.config.mjs`). `migrate deploy` does not need it.                          |
| `NEXTAUTH_SECRET`                    | outside local dev               | Signs the JWT session. Generate one with `openssl rand -base64 32`.                                    |
| `NEXTAUTH_URL`                       | outside local dev               | The app's canonical URL. NextAuth infers it on localhost.                                              |
| `GOOGLE_CLIENT_ID` / `_SECRET`       | to use Google sign-in           | OAuth credentials.                                                                                     |
| `GITHUB_CLIENT_ID` / `_SECRET`       | to use GitHub sign-in           | OAuth credentials.                                                                                     |
| `MAILJET_API_KEY` / `_SECRET_KEY`    | to send password-reset mail     | Without them the reset request fails when it tries to send.                                            |
| `MAILJET_RESET_PASSWORD_TEMPLATE_ID` | to send password-reset mail     | Mailjet template used for the reset email.                                                             |
| `E2E_COVERAGE`                       | never, by hand                  | Set by `npm run test:e2e:coverage`. See [Testing](testing.md#coverage).                                |

Two things that are easy to get wrong:

- **The OAuth providers are always registered**, whether or not their variables are
  set. `authSession.ts` wraps each in `String(...)`, so an unset variable becomes the
  literal `"undefined"` and the button fails at the provider rather than disappearing.
  Sign-up with email and password works regardless — that is the path to use locally.
- **Sentry's DSN is hardcoded** in `src/instrumentation.ts` and
  `sentry.client.config.ts`. There is no `SENTRY_DSN` variable to set.

## Common commands

| Command                    | What it does                                       |
| -------------------------- | -------------------------------------------------- |
| `npm run dev`              | Dev server on port 3000                            |
| `npm run build`            | Production build, into `build/` (into `.next` on Vercel) |
| `npm start`                | Serve a production build                           |
| `npm run test:ci`          | Jest once, with coverage                           |
| `npm test`                 | Jest in **watch mode** — does not exit             |
| `npm run test:e2e`         | Playwright suite (needs one-time setup)            |
| `npm run lint`             | ESLint (`--max-warnings=0`) and Prettier, check only |
| `npm run lint:fix`         | ESLint `--fix` and Prettier `--write`              |
| `npm run spec:coverage`    | Regenerate `openspec/COVERAGE.md`                  |
| `npx prisma migrate dev`   | Create and apply a migration after a schema edit   |
| `npx prisma generate`      | Regenerate the client into `src/generated/prisma`  |

[Testing](testing.md) covers the two test layers in full, including the one-time
setup the Playwright suite needs.

## Troubleshooting

**`port is already allocated` on 3006.** Something else is on that port — often a
previous `docker compose` stack. `docker compose down` first, or change the host side
of the mapping in `docker-compose.yml` and update `POSTGRES_PRISMA_URL` to match.

**Imports from `@/generated/prisma/client` do not resolve.** The client has not been
generated. Run `npx prisma generate`. Do this after every schema change, too — a
stale client typechecks against the old columns.

**`prisma migrate dev` complains about a shadow database.** Set
`POSTGRES_URL_NON_POOLING` as well; `migrate dev` needs somewhere to replay migrations
and `prisma.config.mjs` reads that variable for it.

**Migrations appear to do nothing.** Check which database you are pointed at.
`run-migrations.sh` always targets the compose `saldo` database, and the e2e suite
uses a separate `saldo_test` — running the wrong one is the usual cause of a schema
that looks unchanged.

**Sign-in fails with no visible error.** If you are trying Google or GitHub without
credentials configured, that is expected — see the note above. Use email and password.
