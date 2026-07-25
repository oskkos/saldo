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
