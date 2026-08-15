import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';
import { AbsenceReason, type WorklogFormData } from '@/types';
import { WorklogOverlapError } from '@/services';

// --- Server-layer unit-test harness -----------------------------------------
// Repositories touch three seams we must keep out of jsdom: the Prisma client
// (real generated engine + pg pool), the auth gate (next-auth pulls ESM-only
// `jose`), and the Sentry span wrapper. We also make React's per-request
// `cache` an identity fn so memoization can't leak across tests.
//
// IMPORTANT: `jest.mock` factories on `@/`-aliased paths are only hoisted above
// imports when `jest` is the injected global. This file imports `jest` from
// `@jest/globals` (for types), which disables that hoist — so the mocks are
// registered here at module-eval time and the module under test is pulled in
// via dynamic `import()` in `beforeAll`, after the mocks exist. Reuse this
// pattern for other repository/action unit tests.
jest.mock('@sentry/nextjs', () => ({
  startSpan: (_opts: unknown, cb: (span: unknown) => unknown) =>
    cb({ setAttributes: () => {} }),
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
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    // Clock-out borrows the overlap guard from the worklog repository, which
    // reads this table before the transaction opens.
    worklog: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

type ClockRepo = typeof import('@/repository/clockRepository');
// Permissive mock signature: accepts any args and resolves to any value, so
// mockResolvedValue/mockImplementation type-check without reconstructing Prisma's
// full return shapes (the SUT itself is checked against the real Prisma types).
type ResolvingMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;
type PrismaMock = {
  user: {
    findUnique: ResolvingMock;
    findUniqueOrThrow: ResolvingMock;
    update: ResolvingMock;
    updateMany: ResolvingMock;
  };
  worklog: {
    findMany: ResolvingMock;
  };
  $transaction: ResolvingMock;
};

let repo: ClockRepo;
let db: PrismaMock;
let getUserFromSession: ResolvingMock;

const USER = { id: 42, email: 'clock@example.com', name: 'Clock Tester' };

beforeAll(async () => {
  repo = await import('@/repository/clockRepository');
  db = (await import('@/repository/prisma')).prisma as unknown as PrismaMock;
  getUserFromSession = (await import('@/auth/authSession'))
    .getUserFromSession as unknown as ResolvingMock;
});

beforeEach(() => {
  jest.clearAllMocks();
  getUserFromSession.mockResolvedValue(USER);
  // Nothing stored by default, so the overlap guard clears out of the way.
  db.worklog.findMany.mockResolvedValue([]);
});

describe('getActiveSession', () => {
  it('returns the started_at when a session is open', async () => {
    const startedAt = new Date('2026-07-25T08:00:00.000Z');
    db.user.findUnique.mockResolvedValue({ started_at: startedAt });

    await expect(repo.getActiveSession()).resolves.toEqual({ startedAt });
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER.id },
      select: { started_at: true },
    });
  });

  it('returns null when no session is open', async () => {
    db.user.findUnique.mockResolvedValue({ started_at: null });
    await expect(repo.getActiveSession()).resolves.toBeNull();
  });

  it('returns null when the user row is missing', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(repo.getActiveSession()).resolves.toBeNull();
  });

  it('throws when there is no user in the session', async () => {
    getUserFromSession.mockResolvedValue(null);
    await expect(repo.getActiveSession()).rejects.toThrow('User not found');
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('clockIn', () => {
  it('starts a session only when none is open (idempotent guard)', async () => {
    const startedAt = new Date('2026-07-25T08:00:00.000Z');
    db.user.updateMany.mockResolvedValue({ count: 1 });
    db.user.findUniqueOrThrow.mockResolvedValue({ started_at: startedAt });

    await expect(repo.clockIn(startedAt)).resolves.toEqual({ startedAt });
    // The `started_at: null` guard is what keeps a re-clock-in from overwriting
    // an existing open session.
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { id: USER.id, started_at: null },
      data: { started_at: startedAt },
    });
  });

  // @scenario time-clock/Clock in when already clocked in
  it('leaves an already-open session unchanged (returns the existing start)', async () => {
    const existing = new Date('2026-07-25T06:30:00.000Z');
    const attempted = new Date('2026-07-25T09:00:00.000Z');
    // Guarded updateMany matches nothing; the read returns the pre-existing start.
    db.user.updateMany.mockResolvedValue({ count: 0 });
    db.user.findUniqueOrThrow.mockResolvedValue({ started_at: existing });

    await expect(repo.clockIn(attempted)).resolves.toEqual({
      startedAt: existing,
    });
  });

  it('throws if the session could not be started', async () => {
    db.user.updateMany.mockResolvedValue({ count: 0 });
    db.user.findUniqueOrThrow.mockResolvedValue({ started_at: null });
    await expect(repo.clockIn(new Date())).rejects.toThrow(
      'Failed to start session',
    );
  });

  it('throws when there is no user in the session', async () => {
    getUserFromSession.mockResolvedValue(null);
    await expect(repo.clockIn(new Date())).rejects.toThrow('User not found');
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
});

describe('clockOutWithWorklog', () => {
  const data: WorklogFormData = {
    from: new Date('2026-07-25T08:00:00.000Z'),
    to: new Date('2026-07-25T16:00:00.000Z'),
    comment: 'Shift',
    subtractLunchBreak: true,
  };

  // `claimed` is how many user rows the conditional close matched: 1 when this
  // call is the one that closed an open session, 0 when it was already closed.
  const transaction = (claimed: number) => {
    const tx = {
      worklog: { create: jest.fn() },
      user: {
        updateMany: jest.fn((_args: unknown) =>
          Promise.resolve({ count: claimed }),
        ),
      },
    };
    db.$transaction.mockImplementation((cb: unknown) =>
      Promise.resolve((cb as (t: typeof tx) => unknown)(tx)),
    );
    return tx;
  };

  // @scenario time-clock/Finalizing an open session still works
  // @scenario time-clock/Save creates a worklog
  it('creates the worklog and clears the session in one transaction', async () => {
    const tx = transaction(1);

    await expect(repo.clockOutWithWorklog(data)).resolves.toBe(true);

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: USER.id, started_at: { not: null } },
      data: { started_at: null },
    });
    expect(tx.worklog.create).toHaveBeenCalledWith({
      data: {
        from: data.from,
        to: data.to,
        comment: data.comment,
        user_id: USER.id,
        subtract_lunch_break: data.subtractLunchBreak,
        absence: null,
      },
    });
  });

  // @scenario time-clock/Repeated finalize creates no second worklog
  // @scenario time-clock/Concurrent finalize creates one worklog
  it('writes nothing when the session was already closed', async () => {
    const tx = transaction(0);

    await expect(repo.clockOutWithWorklog(data)).resolves.toBe(false);

    // The conditional close is what makes this safe: whichever call matches the
    // row wins, and the loser finds nothing to claim and writes no worklog.
    expect(tx.user.updateMany).toHaveBeenCalled();
    expect(tx.worklog.create).not.toHaveBeenCalled();
  });

  it('claims the session before writing, so a failed write reopens it', async () => {
    const order: string[] = [];
    const tx = {
      worklog: {
        create: jest.fn(() => {
          order.push('create');
          return Promise.resolve({});
        }),
      },
      user: {
        updateMany: jest.fn(() => {
          order.push('claim');
          return Promise.resolve({ count: 1 });
        }),
      },
    };
    db.$transaction.mockImplementation((cb: unknown) =>
      Promise.resolve((cb as (t: typeof tx) => unknown)(tx)),
    );

    await repo.clockOutWithWorklog(data);

    expect(order).toEqual(['claim', 'create']);
  });

  it('persists the absence reason when the session carries one', async () => {
    const tx = transaction(1);

    await repo.clockOutWithWorklog({
      ...data,
      absence: AbsenceReason.flex_hours,
    });

    expect(tx.worklog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ absence: AbsenceReason.flex_hours }),
    });
  });

  // @scenario time-clock/Declining the overlap keeps the session
  it('leaves the session open when the span overlaps a stored entry', async () => {
    const tx = transaction(1);
    db.worklog.findMany.mockResolvedValue([
      {
        id: 7,
        user_id: USER.id,
        from: new Date('2026-07-25T09:00:00.000Z'),
        to: new Date('2026-07-25T17:00:00.000Z'),
        comment: null,
        subtract_lunch_break: false,
        absence: null,
      },
    ]);

    await expect(repo.clockOutWithWorklog(data)).rejects.toThrow(
      WorklogOverlapError,
    );

    // The check runs before the transaction opens, so nothing was claimed and
    // the user is still clocked in.
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  // @scenario time-clock/Confirming the overlap finalizes normally
  it('finalizes anyway once the overlap is confirmed', async () => {
    const tx = transaction(1);

    await expect(
      repo.clockOutWithWorklog(data, { allowOverlap: true }),
    ).resolves.toBe(true);

    expect(db.worklog.findMany).not.toHaveBeenCalled();
    expect(tx.worklog.create).toHaveBeenCalled();
  });

  it('throws when there is no user in the session', async () => {
    getUserFromSession.mockResolvedValue(null);
    await expect(repo.clockOutWithWorklog(data)).rejects.toThrow(
      'User not found',
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('clearSession', () => {
  it('clears the open session for the user', async () => {
    db.user.update.mockResolvedValue({});
    await repo.clearSession();
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: USER.id },
      data: { started_at: null },
    });
  });

  it('throws when there is no user in the session', async () => {
    getUserFromSession.mockResolvedValue(null);
    await expect(repo.clearSession()).rejects.toThrow('User not found');
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
