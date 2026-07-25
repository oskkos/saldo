// Standalone test-database access for the e2e suite. This deliberately does NOT
// use the app's server-only Prisma singleton (src/repository/prisma.ts) — it
// builds its own client against the e2e database so the Playwright runner
// process can seed and reset state directly. Connection comes from the env that
// playwright.config.ts loads from .env.e2e.
import {
  PrismaClient,
  type Absence,
  type ExpectedHoursOverride,
  type Settings,
  type Worklog,
} from '../src/generated/prisma/client';
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

// The settings every test starts from. The begin date is far in the past so any
// seeded or clock-driven worklog falls in-window.
export const BASELINE_SETTINGS = {
  begin_date: new Date('2020-01-01T00:00:00.000Z'),
  initial_balance_hours: 0,
  initial_balance_mins: 0,
  from_default: '08:00',
  to_default: '16:00',
  expected_minutes_per_day: 450,
};

// Start of a UTC day, offset in days from today. Tests are date-agnostic: they
// seed relative to the real current date and assert relationships, because
// page.clock cannot reach the server's clock.
export function utcDay(offsetDays = 0): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + offsetDays,
    ),
  );
}

/** A UTC instant at `hours:minutes` on the day `offsetDays` from today. */
export function utcTimeOn(
  offsetDays: number,
  hours: number,
  minutes = 0,
): Date {
  const day = utcDay(offsetDays);
  day.setUTCHours(hours, minutes, 0, 0);
  return day;
}

export async function seedWorklog(entry: {
  from: Date;
  to: Date;
  comment?: string;
  subtractLunchBreak?: boolean;
  absence?: Absence;
}): Promise<Worklog> {
  const id = await userId();
  return db().worklog.create({
    data: {
      user_id: id,
      from: entry.from,
      to: entry.to,
      comment: entry.comment ?? '',
      subtract_lunch_break: entry.subtractLunchBreak ?? false,
      absence: entry.absence ?? null,
    },
  });
}

export async function setSettings(
  partial: Partial<typeof BASELINE_SETTINGS>,
): Promise<void> {
  const id = await userId();
  await db().settings.update({ where: { user_id: id }, data: partial });
}

export async function getSettings(): Promise<Settings> {
  const id = await userId();
  return db().settings.findUniqueOrThrow({ where: { user_id: id } });
}

export async function seedOverride(entry: {
  date: Date;
  minutes: number;
  label?: string | null;
}): Promise<ExpectedHoursOverride> {
  const id = await userId();
  return db().expectedHoursOverride.upsert({
    where: { user_id_date: { user_id: id, date: entry.date } },
    create: {
      user_id: id,
      date: entry.date,
      minutes: entry.minutes,
      label: entry.label ?? null,
    },
    update: { minutes: entry.minutes, label: entry.label ?? null },
  });
}

export async function getOverrides(): Promise<ExpectedHoursOverride[]> {
  const id = await userId();
  return db().expectedHoursOverride.findMany({
    where: { user_id: id },
    orderBy: { date: 'asc' },
  });
}

// Put the test user back to a known baseline: no worklogs, no overrides, no open
// session, default settings. Run between tests — the suite is serial and shares
// one user, so a leaked row would surface in the next test.
export async function resetUserData(): Promise<void> {
  const id = await userId();
  await db().worklog.deleteMany({ where: { user_id: id } });
  await db().expectedHoursOverride.deleteMany({ where: { user_id: id } });
  await db().user.update({ where: { id }, data: { started_at: null } });
  await db().settings.update({
    where: { user_id: id },
    data: BASELINE_SETTINGS,
  });
}

// Clear any open session and remove the test user's worklogs so each test starts
// from a known idle state. Kept as the time-clock suite's entry point; the full
// reset is what actually runs.
export async function resetClockState(): Promise<void> {
  await resetUserData();
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
