import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';

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
    expectedHoursOverride: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

type OverrideRepo =
  typeof import('@/repository/expectedHoursOverrideRepository');
type ResolvingMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;
type PrismaMock = {
  expectedHoursOverride: {
    findMany: ResolvingMock;
    findUniqueOrThrow: ResolvingMock;
    upsert: ResolvingMock;
    delete: ResolvingMock;
  };
};

let repo: OverrideRepo;
let db: PrismaMock;
let getUserFromSession: ResolvingMock;

const USER = { id: 42, email: 'hours@example.com', name: 'Hours Tester' };
const OTHER_USER_ID = 99;
const DAY = new Date('2026-12-23T00:00:00.000Z');

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 3,
  user_id: USER.id,
  date: DAY,
  minutes: 300,
  label: 'Christmas Eve eve',
  ...overrides,
});

beforeAll(async () => {
  repo = await import('@/repository/expectedHoursOverrideRepository');
  db = (await import('@/repository/prisma')).prisma as unknown as PrismaMock;
  getUserFromSession = (await import('@/auth/authSession'))
    .getUserFromSession as unknown as ResolvingMock;
});

beforeEach(() => {
  jest.clearAllMocks();
  getUserFromSession.mockResolvedValue(USER);
});

describe('upsertExpectedHoursOverride', () => {
  // @scenario expected-hours/Create an override
  it('persists an override for the session user and date', async () => {
    db.expectedHoursOverride.upsert.mockResolvedValue(row());

    const saved = await repo.upsertExpectedHoursOverride({
      date: DAY,
      minutes: 300,
      label: 'Christmas Eve eve',
    });

    expect(db.expectedHoursOverride.upsert).toHaveBeenCalledWith({
      where: { user_id_date: { user_id: USER.id, date: DAY } },
      create: {
        user_id: USER.id,
        date: DAY,
        minutes: 300,
        label: 'Christmas Eve eve',
      },
      update: { minutes: 300, label: 'Christmas Eve eve' },
    });
    expect(saved).toEqual({
      id: 3,
      date: DAY,
      minutes: 300,
      label: 'Christmas Eve eve',
    });
  });

  // @scenario expected-hours/One override per date
  it('updates the existing row for a date rather than adding a second', async () => {
    db.expectedHoursOverride.upsert.mockResolvedValue(row({ minutes: 240 }));

    await repo.upsertExpectedHoursOverride({
      date: DAY,
      minutes: 240,
      label: undefined,
    });

    // Keyed on (user, date): a second save for the same date lands on the same
    // row through the update branch instead of creating another.
    const call = db.expectedHoursOverride.upsert.mock.calls[0][0] as {
      where: unknown;
      update: unknown;
    };
    expect(call.where).toEqual({
      user_id_date: { user_id: USER.id, date: DAY },
    });
    expect(call.update).toEqual({ minutes: 240, label: null });
  });

  it('normalizes the date to UTC start of day', async () => {
    db.expectedHoursOverride.upsert.mockResolvedValue(row());

    await repo.upsertExpectedHoursOverride({
      date: new Date('2026-12-23T14:37:12.000Z'),
      minutes: 300,
      label: undefined,
    });

    const call = db.expectedHoursOverride.upsert.mock.calls[0][0] as {
      create: { date: Date };
    };
    expect(call.create.date.toISOString()).toBe('2026-12-23T00:00:00.000Z');
  });
});

describe('deleteExpectedHoursOverride', () => {
  it('removes an override owned by the session user', async () => {
    db.expectedHoursOverride.findUniqueOrThrow.mockResolvedValue(row());
    db.expectedHoursOverride.delete.mockResolvedValue(row());

    await repo.deleteExpectedHoursOverride(3);

    expect(db.expectedHoursOverride.delete).toHaveBeenCalledWith({
      where: { id: 3 },
    });
  });

  // @scenario expected-hours/Non-owner mutation rejected
  it('rejects deleting an override owned by someone else', async () => {
    db.expectedHoursOverride.findUniqueOrThrow.mockResolvedValue(
      row({ user_id: OTHER_USER_ID }),
    );

    await expect(repo.deleteExpectedHoursOverride(3)).rejects.toThrow(
      'User mismatch.',
    );
    expect(db.expectedHoursOverride.delete).not.toHaveBeenCalled();
  });

  // @scenario expected-hours/Non-owner mutation rejected
  it("does not let an upsert reach another user's row", async () => {
    db.expectedHoursOverride.upsert.mockResolvedValue(row());

    await repo.upsertExpectedHoursOverride({
      date: DAY,
      minutes: 300,
      label: undefined,
    });

    // The composite key is always scoped to the session user, so an upsert can
    // never land on a row belonging to someone else.
    const call = db.expectedHoursOverride.upsert.mock.calls[0][0] as {
      where: { user_id_date: { user_id: number } };
    };
    expect(call.where.user_id_date.user_id).toBe(USER.id);
    expect(call.where.user_id_date.user_id).not.toBe(OTHER_USER_ID);
  });

  it('refuses to delete without an authenticated session', async () => {
    getUserFromSession.mockResolvedValue(null);

    await expect(repo.deleteExpectedHoursOverride(3)).rejects.toThrow(
      'User not found',
    );
    expect(db.expectedHoursOverride.delete).not.toHaveBeenCalled();
  });
});

describe('getExpectedHoursOverrides', () => {
  it('lists only the session user overrides, oldest first', async () => {
    db.expectedHoursOverride.findMany.mockResolvedValue([row()]);

    const overrides = await repo.getExpectedHoursOverrides();

    expect(db.expectedHoursOverride.findMany).toHaveBeenCalledWith({
      where: { user_id: USER.id },
      orderBy: { date: 'asc' },
    });
    expect(overrides).toHaveLength(1);
  });
});
