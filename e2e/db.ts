// Standalone test-database access for the e2e suite. This deliberately does NOT
// use the app's server-only Prisma singleton (src/repository/prisma.ts) — it
// builds its own client against the e2e database so the Playwright runner
// process can seed and reset state directly. Connection comes from the env that
// playwright.config.ts loads from .env.e2e.
import { PrismaClient, type Worklog } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

// The single user every e2e test authenticates as.
export const TEST_USER = {
  email: 'e2e@example.com',
  password: 'e2e-password',
  name: 'E2E Tester',
};

let client: PrismaClient | undefined;
let pool: Pool | undefined;

function db(): PrismaClient {
  if (!client) {
    pool = new Pool({ connectionString: process.env.POSTGRES_PRISMA_URL });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
  }
  return client;
}

// Upsert the test user (with a bcrypt password so the Credentials provider can
// sign them in) and seed the default Settings a real first sign-in would. The
// begin date is far in the past so any clock-driven worklog falls in-window.
export async function seedTestUser(): Promise<number> {
  const password = await bcrypt.hash(TEST_USER.password, 10);
  const user = await db().user.upsert({
    where: { email: TEST_USER.email },
    update: { password, name: TEST_USER.name },
    create: { email: TEST_USER.email, name: TEST_USER.name, password },
  });
  await db().settings.upsert({
    where: { user_id: user.id },
    update: {},
    create: {
      user_id: user.id,
      begin_date: new Date('2020-01-01T00:00:00.000Z'),
      initial_balance_hours: 0,
      initial_balance_mins: 0,
    },
  });
  return user.id;
}

async function userId(): Promise<number> {
  const user = await db().user.findUniqueOrThrow({
    where: { email: TEST_USER.email },
    select: { id: true },
  });
  return user.id;
}

// Clear any open session and remove the test user's worklogs so each test starts
// from a known idle state.
export async function resetClockState(): Promise<void> {
  const id = await userId();
  await db().worklog.deleteMany({ where: { user_id: id } });
  await db().user.update({ where: { id }, data: { started_at: null } });
}

// Force an open session (used by the "returning with an open session" scenario).
export async function setOpenSession(startedAt: Date): Promise<void> {
  const id = await userId();
  await db().user.update({ where: { id }, data: { started_at: startedAt } });
}

export async function getStartedAt(): Promise<Date | null> {
  const id = await userId();
  const row = await db().user.findUnique({
    where: { id },
    select: { started_at: true },
  });
  return row?.started_at ?? null;
}

export async function getWorklogs(): Promise<Worklog[]> {
  const id = await userId();
  return db().worklog.findMany({
    where: { user_id: id },
    orderBy: { from: 'asc' },
  });
}

export async function disconnect(): Promise<void> {
  await client?.$disconnect();
  await pool?.end();
  client = undefined;
  pool = undefined;
}
