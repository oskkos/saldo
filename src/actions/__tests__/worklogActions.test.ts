import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';
import { AbsenceReason, type WorklogFormData } from '@/types';

// The actions module is the only 'use server' entry point, so this suite is
// where the "validation runs before anything is written" half of the worklog
// spec is asserted: a schema test alone cannot show that the repository was
// never reached. Repositories are mocked for exactly that reason. Mocks are
// registered before the dynamic import, as in the repository suites.
jest.mock('@/repository/worklogRepository', () => ({
  insertWorklog: jest.fn(),
  updateWorklog: jest.fn(),
  deleteWorklog: jest.fn(),
  getWorklogs: jest.fn(),
}));
jest.mock('@/repository/clockRepository', () => ({
  clockIn: jest.fn(),
  clockOutWithWorklog: jest.fn(),
  clearSession: jest.fn(),
  getActiveSession: jest.fn(),
}));
jest.mock('@/repository/settingsRepository', () => ({
  getSettings: jest.fn(),
  upsertSettings: jest.fn(),
  insertSettings: jest.fn(),
}));
jest.mock('@/repository/userRepository', () => ({
  getUserByEmailAndPassword: jest.fn(),
  upsertUser: jest.fn(),
  insertUser: jest.fn(),
  getUserByEmail: jest.fn(),
  updateUserPassword: jest.fn(),
}));
jest.mock('@/repository/expectedHoursOverrideRepository', () => ({
  getExpectedHoursOverrides: jest.fn(),
  upsertExpectedHoursOverride: jest.fn(),
  deleteExpectedHoursOverride: jest.fn(),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

type Actions = typeof import('@/actions');
type ResolvingMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

let actions: Actions;
let insertWorklog: ResolvingMock;
let updateWorklog: ResolvingMock;
let clockOutWithWorklog: ResolvingMock;

const valid: WorklogFormData = {
  from: new Date('2026-06-28T08:00:00.000Z'),
  to: new Date('2026-06-28T16:00:00.000Z'),
  comment: 'Shift',
  subtractLunchBreak: true,
};

beforeAll(async () => {
  actions = await import('@/actions');
  const worklogRepo = await import('@/repository/worklogRepository');
  const clockRepo = await import('@/repository/clockRepository');
  insertWorklog = worklogRepo.insertWorklog as unknown as ResolvingMock;
  updateWorklog = worklogRepo.updateWorklog as unknown as ResolvingMock;
  clockOutWithWorklog =
    clockRepo.clockOutWithWorklog as unknown as ResolvingMock;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('onWorklogSubmit validation', () => {
  // @scenario worklog/Non-positive duration rejected
  it('rejects an end time equal to the start and writes nothing', async () => {
    const sameInstant = { ...valid, to: valid.from };

    await expect(actions.onWorklogSubmit(sameInstant)).rejects.toThrow(
      'End time must be after start time',
    );
    expect(insertWorklog).not.toHaveBeenCalled();
  });

  // @scenario worklog/Non-positive duration rejected
  it('rejects an end time before the start and writes nothing', async () => {
    const reversed = {
      ...valid,
      to: new Date('2026-06-28T07:00:00.000Z'),
    };

    await expect(actions.onWorklogSubmit(reversed)).rejects.toThrow(
      'End time must be after start time',
    );
    expect(insertWorklog).not.toHaveBeenCalled();
  });

  // @scenario worklog/Multi-day span rejected
  // @scenario worklog/Duration crossing midnight is rejected
  it('rejects a span that ends on a later calendar day and writes nothing', async () => {
    const overnight = {
      ...valid,
      from: new Date('2026-06-28T20:00:00.000Z'),
      to: new Date('2026-06-29T03:30:00.000Z'),
    };

    await expect(actions.onWorklogSubmit(overnight)).rejects.toThrow(
      'A worklog must start and end on the same day',
    );
    expect(insertWorklog).not.toHaveBeenCalled();
  });

  // @scenario worklog/Unrecognized absence reason rejected
  it('rejects an absence value outside the recognized set and writes nothing', async () => {
    const bogus = {
      ...valid,
      absence: 'sabbatical',
    } as unknown as WorklogFormData;

    await expect(actions.onWorklogSubmit(bogus)).rejects.toThrow(
      /Invalid option: expected one of/,
    );
    expect(insertWorklog).not.toHaveBeenCalled();
  });

  // @scenario worklog/Valid worklog passes
  // @scenario worklog/Client triggers a write
  it('passes a valid worklog through to the repository', async () => {
    insertWorklog.mockResolvedValue({ id: 7 });

    // The action is the only write path a client component can call; it
    // delegates to the repository rather than touching the database.
    await expect(actions.onWorklogSubmit(valid)).resolves.toEqual({ id: 7 });
    expect(insertWorklog).toHaveBeenCalledWith(valid);
  });

  // @scenario worklog/Valid worklog passes
  it('accepts a recognized absence reason', async () => {
    insertWorklog.mockResolvedValue({ id: 8 });
    const withAbsence = { ...valid, absence: AbsenceReason.holiday };

    await expect(actions.onWorklogSubmit(withAbsence)).resolves.toEqual({
      id: 8,
    });
    expect(insertWorklog).toHaveBeenCalledWith(withAbsence);
  });
});

describe('onWorklogEdit validation', () => {
  // @scenario worklog/Non-positive duration rejected
  it('rejects a non-positive duration on edit and writes nothing', async () => {
    await expect(
      actions.onWorklogEdit(1, { ...valid, to: valid.from }),
    ).rejects.toThrow('End time must be after start time');
    expect(updateWorklog).not.toHaveBeenCalled();
  });
});

// @scenario worklog/Validation is independent of the client
describe('validation does not depend on the calling UI', () => {
  it('applies the same rules to the clock-out path as to the worklog form', async () => {
    const overnight = {
      ...valid,
      from: new Date('2026-06-28T20:00:00.000Z'),
      to: new Date('2026-06-29T03:30:00.000Z'),
    };

    // Same input, a different caller: the time-clock finalize step.
    await expect(actions.onClockOut(overnight)).rejects.toThrow(
      'A worklog must start and end on the same day',
    );
    expect(clockOutWithWorklog).not.toHaveBeenCalled();
  });

  it('accepts through the clock-out path what the worklog form accepts', async () => {
    await actions.onClockOut(valid);

    expect(clockOutWithWorklog).toHaveBeenCalledWith(valid);
  });
});
