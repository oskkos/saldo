import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { COLLECT_COVERAGE, COVERAGE_DIRS } from './constants';
import { seedTestUser, resetClockState, disconnect } from './db';

// Runs once before the whole e2e suite: apply migrations to the e2e database and
// seed the single test user + default settings. Env (incl. POSTGRES_PRISMA_URL
// pointing at saldo_test) is loaded by playwright.config.ts before this runs.
export default async function globalSetup() {
  // Start from an empty coverage directory: a profile left by a previous run would
  // silently pad this one, and a stale report is worse than no report.
  if (COLLECT_COVERAGE) {
    fs.rmSync(COVERAGE_DIRS.root, { recursive: true, force: true });
    fs.mkdirSync(COVERAGE_DIRS.server, { recursive: true });
    fs.mkdirSync(COVERAGE_DIRS.browser, { recursive: true });
    fs.mkdirSync(COVERAGE_DIRS.browserScripts, { recursive: true });
  }

  // `migrate deploy` never uses a shadow database, but prisma.config.mjs derives
  // shadowDatabaseUrl from POSTGRES_URL_NON_POOLING and rejects it when it equals
  // the main URL (which it does for the single e2e DB). Drop it for the deploy so
  // no separate shadow database is required.
  const { POSTGRES_URL_NON_POOLING: _shadow, ...deployEnv } = process.env;
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: deployEnv,
  });
  await seedTestUser();
  await resetClockState();
  await disconnect();
}
