import { describe, it, expect, jest, beforeAll } from '@jest/globals';

// The pool is constructed at module load, so `pg` is mocked to capture the
// options it was given. The Prisma client and adapter are stubbed because
// neither is exercised here.
const poolOptions: Record<string, unknown>[] = [];

jest.mock('pg', () => ({
  Pool: class {
    constructor(options: Record<string, unknown>) {
      poolOptions.push(options);
    }
  },
}));
jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class {},
}));
jest.mock('@/generated/prisma/client', () => ({
  PrismaClient: class {},
}));

// Neon's pooled (pgbouncer) endpoint is the connection budget this must stay
// within; a serverless deployment may run several instances against it.
const SAFE_CONNECTION_BUDGET = 20;

let options: Record<string, unknown>;

beforeAll(async () => {
  await import('@/repository/prisma');
  options = poolOptions[0];
});

describe('database pool configuration', () => {
  // @scenario data-load-performance/Concurrency does not exhaust the database
  it('caps concurrent connections within the safe budget', () => {
    expect(typeof options.max).toBe('number');
    expect(options.max as number).toBeGreaterThan(1);
    expect(options.max as number).toBeLessThanOrEqual(SAFE_CONNECTION_BUDGET);
  });

  // @scenario data-load-performance/Database is slow to accept a connection
  it('bounds how long acquiring a connection may block', () => {
    // Without this the acquisition would wait indefinitely and the serverless
    // function would be killed rather than failing with an error.
    expect(typeof options.connectionTimeoutMillis).toBe('number');
    expect(options.connectionTimeoutMillis as number).toBeGreaterThan(0);
    expect(options.connectionTimeoutMillis as number).toBeLessThanOrEqual(
      30_000,
    );
  });
});
