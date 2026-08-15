import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';
import { AbsenceReason, type WorklogFormData } from '@/types';
import { AbsenceConflictError, WorklogOverlapError } from '@/services';

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
  // Every write now reads before it writes (the overlap lookup), so the default
  // is "nothing stored". Tests that care set their own rows.
  db.worklog.findMany.mockResolvedValue([]);
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

  // A regular worklog is not an absence, so the absence-day guard never runs
  // for it. It does perform the overlap lookup, which is a different query:
  // that one filters on `absence: null` rather than `absence: { not: null }`.
  it('does not run the absence-day lookup for a regular worklog', async () => {
    db.worklog.create.mockResolvedValue(row());

    await repo.insertWorklog(formData);

    expect(db.worklog.findMany).toHaveBeenCalledTimes(1);
    expect(db.worklog.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ absence: { not: null } }),
      }),
    );
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

  // The action tells a refusal apart from a failure by its type, so the type is
  // part of the contract, not an implementation detail.
  it('raises a conflict the caller can recognize', async () => {
    db.worklog.findMany.mockResolvedValue([
      { from: new Date('2026-07-28T08:00:00.000Z') },
    ]);

    await expect(
      repo.insertWorklogs(range(['2026-07-28'])),
    ).rejects.toBeInstanceOf(AbsenceConflictError);
  });

  // The range expansion cannot produce a repeated day, but this is an exported
  // entry point now: a batch that asks for one twice is the same violation.
  it('rejects a batch that asks for the same day twice', async () => {
    db.worklog.findMany.mockResolvedValue([]);

    await expect(
      repo.insertWorklogs(range(['2026-07-28', '2026-07-28'])),
    ).rejects.toThrow('An absence is already recorded for 28.7.2026.');
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

  // @scenario absence/A regular worklog is never blocked by the rule
  it('lets a regular worklog move onto a day that has an absence', async () => {
    db.worklog.findUniqueOrThrow.mockResolvedValue(row());
    db.worklog.update.mockResolvedValue(row({ comment: 'Worked anyway' }));

    await repo.updateWorklog(1, {
      ...movedTo('2026-07-29'),
      comment: 'Worked anyway',
    });

    // The absence rule does not apply to a stored work entry, so no absence-day
    // lookup happens. The only read is the overlap check, which excludes
    // absences — the day's absence is invisible to it and blocks nothing.
    expect(db.worklog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ absence: null }),
      }),
    );
    expect(db.worklog.update).toHaveBeenCalled();
  });
});

describe('the no-silent-overlap rule', () => {
  const DAY = '2026-06-28';
  const at = (time: string) => new Date(`${DAY}T${time}:00.000Z`);
  const workFrom = (fromTime: string, toTime: string): WorklogFormData => ({
    from: at(fromTime),
    to: at(toTime),
    comment: 'Shift',
    subtractLunchBreak: true,
  });
  const storedWork = (fromTime: string, toTime: string, id = 7) =>
    row({ id, from: at(fromTime), to: at(toTime) });

  // The repository asks the database for colliding rows; the half-open
  // comparison is expressed in the query, so these tests assert the query and
  // let the service-level tests cover the predicate itself.
  const queriedSpan = () => {
    const call = db.worklog.findMany.mock.calls[0][0] as {
      where: { from: { lt: Date }; to: { gt: Date }; absence: null };
    };
    return call.where;
  };

  // @scenario worklog/Identical span is reported as a conflict
  it('rejects an entry identical to one already stored', async () => {
    db.worklog.findMany.mockResolvedValue([storedWork('09:00', '17:00')]);

    await expect(
      repo.insertWorklog(workFrom('09:00', '17:00')),
    ).rejects.toThrow(WorklogOverlapError);
    expect(db.worklog.create).not.toHaveBeenCalled();
  });

  // @scenario worklog/Partially overlapping span is reported as a conflict
  it('rejects an entry that partially overlaps a stored one', async () => {
    db.worklog.findMany.mockResolvedValue([storedWork('09:00', '17:00')]);

    await expect(
      repo.insertWorklog(workFrom('16:00', '18:00')),
    ).rejects.toThrow(WorklogOverlapError);
    expect(db.worklog.create).not.toHaveBeenCalled();
  });

  // @scenario worklog/The conflict names the entry it collides with
  it('carries the colliding span on the error', async () => {
    db.worklog.findMany.mockResolvedValue([storedWork('09:00', '17:00')]);

    await expect(
      repo.insertWorklog(workFrom('16:00', '18:00')),
    ).rejects.toMatchObject({
      spans: [{ from: at('09:00'), to: at('17:00') }],
    });
  });

  // @scenario worklog/Touching spans are not a conflict
  // @scenario worklog/Non-overlapping spans are not a conflict
  it('bounds the lookup half-open, so touching entries never match', async () => {
    db.worklog.create.mockResolvedValue(row());

    await repo.insertWorklog(workFrom('12:00', '16:00'));

    // An entry ending exactly at 12:00 is excluded by `to > from`, and one
    // starting exactly at 16:00 by `from < to`.
    expect(queriedSpan()).toEqual(
      expect.objectContaining({
        user_id: USER.id,
        absence: null,
        from: { lt: at('16:00') },
        to: { gt: at('12:00') },
      }),
    );
    expect(db.worklog.create).toHaveBeenCalled();
  });

  // @scenario worklog/Work on an absence day is not a conflict
  it('excludes stored absences from the lookup', async () => {
    db.worklog.create.mockResolvedValue(row());

    await repo.insertWorklog(workFrom('09:00', '17:00'));

    expect(queriedSpan().absence).toBeNull();
    expect(db.worklog.create).toHaveBeenCalled();
  });

  // @scenario worklog/An incoming absence is not overlap-checked
  it('does not overlap-check an incoming absence', async () => {
    db.worklog.create.mockResolvedValue(row({ absence: 'holiday' }));

    await repo.insertWorklog({
      ...workFrom('08:00', '16:00'),
      absence: AbsenceReason.holiday,
    });

    // The one lookup that happened is the absence-day guard, which selects only
    // `from` and filters on `absence: { not: null }` — not the overlap query.
    expect(db.worklog.findMany).toHaveBeenCalledTimes(1);
    expect(queriedSpan()).toEqual(
      expect.objectContaining({ absence: { not: null } }),
    );
  });

  // @scenario worklog/Confirmed overlap is persisted
  it('persists without checking when the overlap is allowed', async () => {
    db.worklog.create.mockResolvedValue(row());

    await repo.insertWorklog(workFrom('09:00', '17:00'), {
      allowOverlap: true,
    });

    expect(db.worklog.findMany).not.toHaveBeenCalled();
    expect(db.worklog.create).toHaveBeenCalled();
  });

  // @scenario worklog/Editing an entry does not conflict with itself
  it('excludes the edited row from its own comparison', async () => {
    db.worklog.findUniqueOrThrow.mockResolvedValue(
      storedWork('09:00', '17:00', 3),
    );
    db.worklog.update.mockResolvedValue(storedWork('09:00', '18:00', 3));

    await repo.updateWorklog(3, workFrom('09:00', '18:00'));

    expect(queriedSpan()).toEqual(expect.objectContaining({ id: { not: 3 } }));
    expect(db.worklog.update).toHaveBeenCalled();
  });

  // @scenario worklog/Editing onto an occupied span is reported as a conflict
  it('rejects an edit that moves an entry onto an occupied span', async () => {
    db.worklog.findUniqueOrThrow.mockResolvedValue(
      storedWork('08:00', '10:00', 3),
    );
    db.worklog.findMany.mockResolvedValue([storedWork('13:00', '16:00', 4)]);

    await expect(
      repo.updateWorklog(3, workFrom('08:00', '14:00')),
    ).rejects.toThrow(WorklogOverlapError);
    expect(db.worklog.update).not.toHaveBeenCalled();
  });

  it('lets a confirmed edit through', async () => {
    db.worklog.findUniqueOrThrow.mockResolvedValue(
      storedWork('08:00', '10:00', 3),
    );
    db.worklog.update.mockResolvedValue(storedWork('08:00', '14:00', 3));

    await repo.updateWorklog(3, workFrom('08:00', '14:00'), {
      allowOverlap: true,
    });

    expect(db.worklog.findMany).not.toHaveBeenCalled();
    expect(db.worklog.update).toHaveBeenCalled();
  });

  // @scenario worklog/Detection uses stored state, not the client's view
  it('reads stored rows rather than trusting anything supplied by the caller', async () => {
    db.worklog.findMany.mockResolvedValue([storedWork('09:00', '17:00')]);

    // The caller passes only its own entry; the conflicting one is known solely
    // from the database.
    await expect(
      repo.insertWorklog(workFrom('10:00', '12:00')),
    ).rejects.toThrow(WorklogOverlapError);
    expect(db.worklog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user_id: USER.id }),
      }),
    );
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
