#!/usr/bin/env bash
set -euo pipefail

docker compose up -d db

POSTGRES_PRISMA_URL="postgres://postgres:password@localhost:3006/saldo" npx prisma migrate deploy
