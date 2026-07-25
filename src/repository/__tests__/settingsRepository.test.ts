import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';
import type { SettingsData } from '@/types';

// Same server-layer harness as clockRepository.test.ts — see that file for why
// the mocks are registered before a dynamic import of the module under test.
jest.mock('@sentry/nextjs', () => ({
  startSpan: (_opts: unknown, cb: () => unknown) => cb(),
}));
jest.mock('react', () => ({
  ...(jest.requireActual('react') as object),
  cache: (fn: unknown) => fn,
}));
jest.mock('@/auth/authSession', () => ({
  getUserFromSession: jest.fn(),
  getSession: jest.fn(),
}));
jest.mock('@/repository/prisma', () => ({
  prisma: {
    settings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

type SettingsRepo = typeof import('@/repository/settingsRepository');
type ResolvingMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;
type PrismaMock = {
  settings: { findUnique: ResolvingMock; upsert: ResolvingMock };
};

let repo: SettingsRepo;
let db: PrismaMock;
let getUserFromSession: ResolvingMock;

const USER = { id: 42, email: 'settings@example.com', name: 'Settings Tester' };

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  user_id: USER.id,
  begin_date: new Date('2026-01-01T00:00:00.000Z'),
  initial_balance_hours: 2,
  initial_balance_mins: 30,
  from_default: '08:00',
  to_default: '16:00',
  expected_minutes_per_day: 450,
  ...overrides,
});

const data: SettingsData = {
  beginDate: new Date('2026-02-01T00:00:00.000Z'),
  initialBalanceHours: 1,
  initialBalanceMins: 15,
  fromDefault: '09:00' as SettingsData['fromDefault'],
  toDefault: '17:00' as SettingsData['toDefault'],
  expectedMinutesPerDay: 420,
};

beforeAll(async () => {
  repo = await import('@/repository/settingsRepository');
  db = (await import('@/repository/prisma')).prisma as unknown as PrismaMock;
  getUserFromSession = (await import('@/auth/authSession'))
    .getUserFromSession as unknown as ResolvingMock;
});

beforeEach(() => {
  jest.clearAllMocks();
  getUserFromSession.mockResolvedValue(USER);
});

describe('getSettings', () => {
  // @scenario settings/Read own settings
  it("returns the session user's single settings row", async () => {
    db.settings.findUnique.mockResolvedValue(row());

    const settings = await repo.getSettings();

    expect(db.settings.findUnique).toHaveBeenCalledWith({
      where: { user_id: USER.id },
    });
    expect(settings).toEqual({
      id: 5,
      beginDate: new Date('2026-01-01T00:00:00.000Z'),
      initialBalanceHours: 2,
      initialBalanceMins: 30,
      fromDefault: '08:00',
      toDefault: '16:00',
      expectedMinutesPerDay: 450,
    });
  });

  // @scenario settings/No settings yet
  it('returns null when the user has no settings row', async () => {
    db.settings.findUnique.mockResolvedValue(null);

    await expect(repo.getSettings()).resolves.toBeNull();
  });

  // @scenario settings/Stored times are validated on read
  it('rejects a stored from-time that is not a time of day', async () => {
    db.settings.findUnique.mockResolvedValue(row({ from_default: 'morning' }));

    await expect(repo.getSettings()).rejects.toThrow();
  });

  // @scenario settings/Stored times are validated on read
  it('rejects a stored to-time that is not in HH:MM form', async () => {
    db.settings.findUnique.mockResolvedValue(row({ to_default: '8:00' }));

    await expect(repo.getSettings()).rejects.toThrow();
  });

  it('accepts an out-of-range hour, which the shape check does not catch', () => {
    // Documents the current boundary of assertIsTime: it validates the HH:MM
    // shape, not that the hour is 00-23. '25:00' therefore passes through.
    db.settings.findUnique.mockResolvedValue(row({ to_default: '25:00' }));

    return expect(repo.getSettings()).resolves.toEqual(
      expect.objectContaining({ toDefault: '25:00' }),
    );
  });

  it('refuses to read without an authenticated session', async () => {
    getUserFromSession.mockResolvedValue(null);

    await expect(repo.getSettings()).rejects.toThrow('User not found');
    expect(db.settings.findUnique).not.toHaveBeenCalled();
  });
});

describe('upsertSettings', () => {
  // @scenario settings/Save settings
  it("updates the user's row with the submitted values", async () => {
    db.settings.upsert.mockResolvedValue(
      row({
        begin_date: data.beginDate,
        initial_balance_hours: 1,
        initial_balance_mins: 15,
        from_default: '09:00',
        to_default: '17:00',
        expected_minutes_per_day: 420,
      }),
    );

    const saved = await repo.upsertSettings(data);

    expect(db.settings.upsert).toHaveBeenCalledWith({
      where: { user_id: USER.id },
      create: expect.objectContaining({
        user_id: USER.id,
        begin_date: data.beginDate,
        expected_minutes_per_day: 420,
      }),
      update: expect.objectContaining({
        begin_date: data.beginDate,
        initial_balance_hours: 1,
        initial_balance_mins: 15,
        from_default: '09:00',
        to_default: '17:00',
        expected_minutes_per_day: 420,
      }),
    });
    expect(saved.expectedMinutesPerDay).toBe(420);
  });

  it('refuses to save without an authenticated session', async () => {
    getUserFromSession.mockResolvedValue(null);

    await expect(repo.upsertSettings(data)).rejects.toThrow('User not found');
    expect(db.settings.upsert).not.toHaveBeenCalled();
  });
});
