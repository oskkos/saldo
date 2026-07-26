import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';
import { AbsenceReason, type WorklogFormData } from '@/types';

// Same server-layer harness as clockRepository.test.ts: the Prisma client, the
// auth gate and the Sentry span wrapper are mocked, React's per-request `cache`
// is an identity fn, and the module under test is imported after the mocks
// exist. See that file for why the dynamic import is required.
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
    worklog: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      createManyAndReturn: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

type WorklogRepo = typeof import('@/repository/worklogRepository');
type ResolvingMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;
type PrismaMock = {
  worklog: {
    findMany: ResolvingMock;
    findUniqueOrThrow: ResolvingMock;
    create: ResolvingMock;
    createManyAndReturn: ResolvingMock;
    update: ResolvingMock;
    delete: ResolvingMock;
  };
};

let repo: WorklogRepo;
let db: PrismaMock;
let getUserFromSession: ResolvingMock;

const USER = { id: 42, email: 'worklog@example.com', name: 'Worklog Tester' };
const OTHER_USER_ID = 99;

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  user_id: USER.id,
  from: new Date('2026-06-28T08:00:00.000Z'),
  to: new Date('2026-06-28T16:00:00.000Z'),
  comment: 'Shift',
  subtract_lunch_break: true,
  absence: null,
  ...overrides,
});

const formData: WorklogFormData = {
  from: new Date('2026-06-28T08:00:00.000Z'),
  to: new Date('2026-06-28T16:00:00.000Z'),
  comment: 'Shift',
  subtractLunchBreak: true,
};

beforeAll(async () => {
  repo = await import('@/repository/worklogRepository');
  db = (await import('@/repository/prisma')).prisma as unknown as PrismaMock;
  getUserFromSession = (await import('@/auth/authSession'))
    .getUserFromSession as unknown as ResolvingMock;
});

beforeEach(() => {
  jest.clearAllMocks();
  getUserFromSession.mockResolvedValue(USER);
});

describe('getWorklogs', () => {
  // @scenario worklog/Listing returns only own worklogs
  it('scopes the query to the session user', async () => {
    db.worklog.findMany.mockResolvedValue([row()]);

    const worklogs = await repo.getWorklogs();

    expect(db.worklog.findMany).toHaveBeenCalledWith({
      where: {
        user_id: USER.id,
        from: { gte: undefined },
        to: { lte: undefined },
      },
    });
    expect(worklogs).toEqual([
      {
        id: 1,
        from: new Date('2026-06-28T08:00:00.000Z'),
        to: new Date('2026-06-28T16:00:00.000Z'),
        comment: 'Shift',
        subtractLunchBreak: true,
        absence: null,
      },
    ]);
  });

  // @scenario worklog/Range query
  it('bounds the query by the given from and to dates', async () => {
    const from = new Date('2026-06-01T00:00:00.000Z');
    const to = new Date('2026-06-30T23:59:59.000Z');
    db.worklog.findMany.mockResolvedValue([]);

    await repo.getWorklogs(from, to);

    expect(db.worklog.findMany).toHaveBeenCalledWith({
      where: { user_id: USER.id, from: { gte: from }, to: { lte: to } },
    });
  });

  // @scenario worklog/Unbounded query
  it('applies no date bounds when none are given', async () => {
    db.worklog.findMany.mockResolvedValue([row(), row({ id: 2 })]);

    const worklogs = await repo.getWorklogs();

    expect(db.worklog.findMany).toHaveBeenCalledWith({
      where: {
        user_id: USER.id,
        from: { gte: undefined },
        to: { lte: undefined },
      },
    });
    expect(worklogs).toHaveLength(2);
  });

  // @scenario worklog/Unknown absence value
  it('throws rather than mapping an unrecognized absence value', async () => {
    db.worklog.findMany.mockResolvedValue([row({ absence: 'sabbatical' })]);

    await expect(repo.getWorklogs()).rejects.toThrow();
  });

  it('maps a recognized absence value through to the domain type', async () => {
    db.worklog.findMany.mockResolvedValue([row({ absence: 'flex_hours' })]);

    const [worklog] = await repo.getWorklogs();

    expect(worklog.absence).toBe(AbsenceReason.flex_hours);
  });
});

describe('insertWorklog', () => {
  // @scenario worklog/Regular entry
  it('persists a new record for the session user and returns it', async () => {
    db.worklog.create.mockResolvedValue(row());

    const created = await repo.insertWorklog(formData);

    expect(db.worklog.create).toHaveBeenCalledWith({
      data: {
        from: formData.from,
        to: formData.to,
        comment: formData.comment,
        user_id: USER.id,
        subtract_lunch_break: formData.subtractLunchBreak,
        absence: undefined,
      },
    });
    expect(created).toEqual(
      expect.objectContaining({ id: 1, comment: 'Shift', absence: null }),
    );
  });
});

describe('the one-absence-per-day rule', () => {
  const DAY = '2026-07-28';
  const absenceOn = (day: string, absence: AbsenceReason): WorklogFormData => ({
    from: new Date(`${day}T08:00:00.000Z`),
    to: new Date(`${day}T16:00:00.000Z`),
    comment: 'Away',
    subtractLunchBreak: true,
    absence,
  });
  // The guard reads only `from`; an absence occupies its whole day.
  const takenOn = (...days: string[]) =>
    days.map((day) => ({ from: new Date(`${day}T08:00:00.000Z`) }));

  // @scenario absence/Second absence with the same reason is rejected
  it('rejects a repeat of the same reason and writes nothing', async () => {
    db.worklog.findMany.mockResolvedValue(takenOn(DAY));

    await expect(
      repo.insertWorklog(absenceOn(DAY, AbsenceReason.holiday)),
    ).rejects.toThrow('An absence is already recorded for 28.7.2026.');
    expect(db.worklog.create).not.toHaveBeenCalled();
  });

  // @scenario absence/Second absence with a different reason is also rejected
  it('rejects a different reason on the same day just as firmly', async () => {
    db.worklog.findMany.mockResolvedValue(takenOn(DAY));

    await expect(
      repo.insertWorklog(absenceOn(DAY, AbsenceReason.sick_leave)),
    ).rejects.toThrow('An absence is already recorded for 28.7.2026.');
    expect(db.worklog.create).not.toHaveBeenCalled();
  });

  it('queries only absences of the session user, bounded to the day', async () => {
    db.worklog.findMany.mockResolvedValue([]);
    db.worklog.create.mockResolvedValue(row({ absence: 'holiday' }));

    await repo.insertWorklog(absenceOn(DAY, AbsenceReason.holiday));

    expect(db.worklog.findMany).toHaveBeenCalledWith({
      where: {
        user_id: USER.id,
        absence: { not: null },
        from: {
          gte: new Date(`${DAY}T00:00:00.000Z`),
          lte: new Date(`${DAY}T23:59:59.999Z`),
        },
      },
      select: { from: true },
    });
  });

  it('writes the absence when the day is free', async () => {
    db.worklog.findMany.mockResolvedValue([]);
    db.worklog.create.mockResolvedValue(row({ absence: 'holiday' }));

    const created = await repo.insertWorklog(
      absenceOn(DAY, AbsenceReason.holiday),
    );

    expect(db.worklog.create).toHaveBeenCalled();
    expect(created.absence).toBe(AbsenceReason.holiday);
  });

  // The common case must not pay for the rule: a regular worklog is not an
  // absence, so nothing needs looking up.
  it('does not query at all for a regular worklog', async () => {
    db.worklog.create.mockResolvedValue(row());

    await repo.insertWorklog(formData);

    expect(db.worklog.findMany).not.toHaveBeenCalled();
    expect(db.worklog.create).toHaveBeenCalled();
  });
});

describe('insertWorklogs', () => {
  const range = (days: string[]): WorklogFormData[] =>
    days.map((day) => ({
      from: new Date(`${day}T08:00:00.000Z`),
      to: new Date(`${day}T16:00:00.000Z`),
      comment: 'Away',
      subtractLunchBreak: true,
      absence: AbsenceReason.holiday,
    }));

  // @scenario absence/One taken day rejects the whole range
  it('writes nothing when one day of the range is already taken', async () => {
    db.worklog.findMany.mockResolvedValue([
      { from: new Date('2026-07-30T08:00:00.000Z') },
    ]);

    await expect(
      repo.insertWorklogs(
        range([
          '2026-07-28',
          '2026-07-29',
          '2026-07-30',
          '2026-07-31',
          '2026-08-01',
        ]),
      ),
    ).rejects.toThrow('An absence is already recorded for 30.7.2026.');
    expect(db.worklog.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('bounds the conflict lookup by the ends of the range', async () => {
    db.worklog.findMany.mockResolvedValue([]);
    db.worklog.createManyAndReturn.mockResolvedValue([]);

    await repo.insertWorklogs(
      range(['2026-07-28', '2026-07-29', '2026-07-30']),
    );

    expect(db.worklog.findMany).toHaveBeenCalledWith({
      where: {
        user_id: USER.id,
        absence: { not: null },
        from: {
          gte: new Date('2026-07-28T00:00:00.000Z'),
          lte: new Date('2026-07-30T23:59:59.999Z'),
        },
      },
      select: { from: true },
    });
  });

  it('writes every day of a clean range in one statement', async () => {
    db.worklog.findMany.mockResolvedValue([]);
    db.worklog.createManyAndReturn.mockResolvedValue([
      row({ id: 1, absence: 'holiday' }),
      row({ id: 2, absence: 'holiday' }),
    ]);

    const created = await repo.insertWorklogs(
      range(['2026-07-28', '2026-07-29']),
    );

    expect(db.worklog.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(db.worklog.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          from: new Date('2026-07-28T08:00:00.000Z'),
          user_id: USER.id,
          absence: AbsenceReason.holiday,
        }),
        expect.objectContaining({
          from: new Date('2026-07-29T08:00:00.000Z'),
          user_id: USER.id,
          absence: AbsenceReason.holiday,
        }),
      ],
    });
    expect(created).toHaveLength(2);
  });
});

describe('updateWorklog', () => {
  // @scenario worklog/Owner edits
  it('updates the listed fields and returns the record', async () => {
    db.worklog.findUniqueOrThrow.mockResolvedValue(row());
    db.worklog.update.mockResolvedValue(row({ comment: 'Edited' }));

    const updated = await repo.updateWorklog(1, {
      ...formData,
      comment: 'Edited',
    });

    expect(db.worklog.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        from: formData.from,
        to: formData.to,
        comment: 'Edited',
        subtract_lunch_break: formData.subtractLunchBreak,
      },
    });
    expect(updated.comment).toBe('Edited');
  });

  // @scenario worklog/Non-owner edit rejected
  it('rejects an edit of a worklog owned by someone else', async () => {
    db.worklog.findUniqueOrThrow.mockResolvedValue(
      row({ user_id: OTHER_USER_ID }),
    );

    await expect(repo.updateWorklog(1, formData)).rejects.toThrow(
      'User mismatch.',
    );
    expect(db.worklog.update).not.toHaveBeenCalled();
  });

  const absenceRow = (day: string) =>
    row({
      absence: 'holiday',
      from: new Date(`${day}T08:00:00.000Z`),
      to: new Date(`${day}T16:00:00.000Z`),
    });
  const movedTo = (day: string): WorklogFormData => ({
    from: new Date(`${day}T08:00:00.000Z`),
    to: new Date(`${day}T16:00:00.000Z`),
    comment: 'Away',
    subtractLunchBreak: true,
  });

  // @scenario absence/Moving an absence onto a taken day is rejected
  it('refuses to move an absence onto a day that already has one', async () => {
    db.worklog.findUniqueOrThrow.mockResolvedValue(absenceRow('2026-07-28'));
    db.worklog.findMany.mockResolvedValue([
      { from: new Date('2026-07-29T08:00:00.000Z') },
    ]);

    await expect(repo.updateWorklog(1, movedTo('2026-07-29'))).rejects.toThrow(
      'An absence is already recorded for 29.7.2026.',
    );
    expect(db.worklog.update).not.toHaveBeenCalled();
  });

  it('moves an absence onto a free day', async () => {
    db.worklog.findUniqueOrThrow.mockResolvedValue(absenceRow('2026-07-28'));
    db.worklog.findMany.mockResolvedValue([]);
    db.worklog.update.mockResolvedValue(absenceRow('2026-07-29'));

    await repo.updateWorklog(1, movedTo('2026-07-29'));

    expect(db.worklog.update).toHaveBeenCalled();
  });

  // Editing an absence in place is not a move, so it cannot collide with
  // itself and needs no lookup.
  it('edits an absence on its own day without checking for conflicts', async () => {
    db.worklog.findUniqueOrThrow.mockResolvedValue(absenceRow('2026-07-28'));
    db.worklog.update.mockResolvedValue(absenceRow('2026-07-28'));

    await repo.updateWorklog(1, movedTo('2026-07-28'));

    expect(db.worklog.findMany).not.toHaveBeenCalled();
    expect(db.worklog.update).toHaveBeenCalled();
  });

  // @scenario absence/Moving a regular worklog onto an absence day is allowed
  it('lets a regular worklog move onto a day that has an absence', async () => {
    db.worklog.findUniqueOrThrow.mockResolvedValue(row());
    db.worklog.update.mockResolvedValue(row({ comment: 'Worked anyway' }));

    await repo.updateWorklog(1, {
      ...movedTo('2026-07-29'),
      comment: 'Worked anyway',
    });

    // No conflict lookup happens at all: the stored record is not an absence,
    // so the rule does not apply to it.
    expect(db.worklog.findMany).not.toHaveBeenCalled();
    expect(db.worklog.update).toHaveBeenCalled();
  });
});

describe('deleteWorklog', () => {
  // @scenario worklog/Owner deletes
  it('removes a worklog owned by the session user', async () => {
    db.worklog.findUniqueOrThrow.mockResolvedValue(row());
    db.worklog.delete.mockResolvedValue(row());

    await repo.deleteWorklog(1);

    expect(db.worklog.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  // @scenario worklog/Non-owner delete rejected
  it('rejects a delete of a worklog owned by someone else', async () => {
    db.worklog.findUniqueOrThrow.mockResolvedValue(
      row({ user_id: OTHER_USER_ID }),
    );

    await expect(repo.deleteWorklog(1)).rejects.toThrow('User mismatch.');
    expect(db.worklog.delete).not.toHaveBeenCalled();
  });
});

// @scenario worklog/No session
describe('without an authenticated session', () => {
  beforeEach(() => {
    getUserFromSession.mockResolvedValue(null);
  });

  it('refuses to list worklogs and reads nothing', async () => {
    await expect(repo.getWorklogs()).rejects.toThrow('User not found');
    expect(db.worklog.findMany).not.toHaveBeenCalled();
  });

  it('refuses to insert a worklog and writes nothing', async () => {
    await expect(repo.insertWorklog(formData)).rejects.toThrow(
      'User not found',
    );
    expect(db.worklog.create).not.toHaveBeenCalled();
  });

  it('refuses to update a worklog and writes nothing', async () => {
    await expect(repo.updateWorklog(1, formData)).rejects.toThrow(
      'User not found',
    );
    expect(db.worklog.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(db.worklog.update).not.toHaveBeenCalled();
  });

  it('refuses to delete a worklog and removes nothing', async () => {
    await expect(repo.deleteWorklog(1)).rejects.toThrow('User not found');
    expect(db.worklog.delete).not.toHaveBeenCalled();
  });
});
