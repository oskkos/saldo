import { PrismaClient } from '@/generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString: process.env.POSTGRES_PRISMA_URL,
    // POSTGRES_PRISMA_URL is the Neon *pooled* (-pooler / pgbouncer) endpoint,
    // so we can afford several connections. A pool of 1 forced every query —
    // even Promise.all reads — to run single-file, which stacked Neon
    // cold-start latency on the initial page load. Allow independent reads to
    // overlap instead.
    max: 10,
    // Bound client acquisition (the new-client handshake, and queueing when all
    // `max` connections are busy) so it can't hang indefinitely. Note: on the
    // pooled endpoint the Neon cold-start *wake* surfaces as query latency, not
    // connect latency, so that path is governed by the route `maxDuration`, not
    // this timeout. There is no automatic retry — a breached timeout rejects.
    connectionTimeoutMillis: 5000,
  });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: adapter,
    log: [/*'query', 'info', */ 'warn', 'error'],
  });

globalForPrisma.pgPool = pool;
globalForPrisma.prisma = prisma;
