# Getting Started

Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose

Install dependencies

- npm install

Run locally (without Docker)

- Ensure a PostgreSQL database is available and set POSTGRES_PRISMA_URL in .env
- Apply migrations: POSTGRES_PRISMA_URL="postgres://postgres:password@localhost:3006/saldo" npx prisma migrate deploy
- Start dev server: npm run dev

Run with Docker Compose

- Start database: docker compose up -d db (Postgres exposed at localhost:3006)
- Apply migrations in the compose environment: ./run-migrations.sh
  - The script brings up db and runs: POSTGRES_PRISMA_URL="postgres://postgres:password@localhost:3006/saldo" npx prisma migrate deploy
- Start app: docker compose up (app on http://localhost:3000)
  - The dev container also runs npm install and starts Next.js

Environment variables

- POSTGRES_PRISMA_URL: Database connection string used by Prisma and runtime
- POSTGRES_URL_NON_POOLING: Optional; not required for prisma migrate deploy
- NEXTAUTH_URL, NEXTAUTH_SECRET: Required for auth in non-local environments
- Provider OAuth credentials as needed (e.g., GITHUB*\*, GOOGLE*\*)
- Optional: SENTRY_DSN

Common commands

- Build: npm run build
- Test (CI): npm run test:ci
- Lint/format (CI): npm run lint:ci && npm run prettier:ci
