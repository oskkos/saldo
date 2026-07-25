import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { STORAGE_STATE } from './e2e/constants';

// Load the e2e env (dedicated test DB, NextAuth secret) before anything reads
// process.env — global setup, the DB helpers, and the app server all rely on it.
dotenv.config({ path: path.join(__dirname, '.env.e2e') });

// A dedicated port (not Next's default 3000) so the e2e app never collides with
// another dev server the developer already has running on 3000.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

// Vars the app server needs. Passed explicitly so they win over the app's own
// .env (which points at the dev database).
const serverEnv = {
  ...process.env,
  POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL!,
  POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING!,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  NEXTAUTH_URL: baseURL,
  PORT: String(PORT),
  // Run the app server in a non-UTC zone so the "logged times match the clock
  // regardless of server timezone" scenario is a real test: the browser
  // captures the wall-clock (pinned to UTC below) and the server must not shift
  // it.
  TZ: 'America/New_York',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL,
    trace: 'on-first-retry',
    // Pin the browser wall-clock to UTC so page.clock times map directly to the
    // stored (wall-clock-as-UTC) worklog times.
    timezoneId: 'UTC',
  },

  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
      testMatch: /.*\.spec\.ts/,
    },
  ],

  webServer: {
    // Prod build in CI for fidelity; the dev server locally for a fast loop.
    command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // Generous: in CI the command builds the app before starting it.
    timeout: 300_000,
    env: serverEnv,
  },
});
