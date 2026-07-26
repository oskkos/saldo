import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';
import { AbsenceReason, type AbsenceData } from '@/types';
import { AbsenceConflictError } from '@/services';
import type { Date_ISODay } from '@/util/dateFormatter';

// Same harness as worklogActions.test.ts: repositories are mocked so the suite
// can show that a rejected absence never reaches a write, and the module under
// test is imported dynamically after the mocks exist.
jest.mock('@/repository/worklogRepository', () => ({
  insertWorklog: jest.fn(),
  insertWorklogs: jest.fn(),
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
  getUser: jest.fn(),
  getUserByEmailAndPassword: jest.fn(),
  upsertUser: jest.fn(),
  signupUser: jest.fn(),
  updatePasswordByResetToken: jest.fn(),
  upsertPasswordResetData: jest.fn(),
}));
jest.mock('@/repository/expectedHoursOverrideRepository', () => ({
  getExpectedHoursOverrides: jest.fn(),
  upsertExpectedHoursOverride: jest.fn(),
  deleteExpectedHoursOverride: jest.fn(),
}));

type Actions = typeof import('@/actions');
type ResolvingMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

let actions: Actions;
let insertWorklogs: ResolvingMock;
let getSettings: ResolvingMock;

// A user whose working day is 09:00-17:00, deliberately different from the
// application-wide 08:00-16:00 defaults so the two cannot be confused.
const settings = {
  id: 1,
  beginDate: new Date('2026-01-01T00:00:00.000Z'),
  initialBalanceHours: 0,
  initialBalanceMins: 0,
  fromDefault: '09:00',
  toDefault: '17:00',
  expectedMinutesPerDay: 450,
};

const valid: AbsenceData = {
  from: new Date('2026-07-28T00:00:00.000Z'),
  to: new Date('2026-07-30T00:00:00.000Z'),
  reason: AbsenceReason.holiday,
  comment: 'Away',
};

beforeAll(async () => {
  actions = await import('@/actions');
  const worklogRepo = await import('@/repository/worklogRepository');
  const settingsRepo = await import('@/repository/settingsRepository');
  insertWorklogs = worklogRepo.insertWorklogs as unknown as ResolvingMock;
  getSettings = settingsRepo.getSettings as unknown as ResolvingMock;
});

beforeEach(() => {
  jest.clearAllMocks();
  getSettings.mockResolvedValue(settings);
  insertWorklogs.mockResolvedValue([]);
});

// Every refusal comes back as a value. Throwing would not reach the user: a
// production build replaces the message of anything raised out of a server
// action with an opaque digest.
const refusal = async (data: AbsenceData) => {
  const result = await actions.onAbsenceSubmit(data);
  expect(result.status).toBe('error');
  expect(insertWorklogs).not.toHaveBeenCalled();
  return result.status === 'error' ? result.message : '';
};

describe('onAbsenceSubmit validation', () => {
  it('refuses a missing reason and writes nothing', async () => {
    expect(await refusal({ ...valid, reason: undefined })).toBe(
      'Reason is required',
    );
  });

  it('refuses a missing from-date and writes nothing', async () => {
    expect(await refusal({ ...valid, from: null })).toBe(
      'From date is required',
    );
  });

  it('refuses a to-date before the from-date and writes nothing', async () => {
    expect(
      await refusal({ ...valid, to: new Date('2026-07-27T00:00:00.000Z') }),
    ).toBe('The to-date must not be before the from-date');
  });

  // Only the days matter, so a same-day range must survive whatever times the
  // client's two ends happen to carry, in either order.
  it('accepts a same-day range whose ends run backwards in time', async () => {
    const result = await actions.onAbsenceSubmit({
      ...valid,
      from: new Date('2026-07-28T18:00:00.000Z'),
      to: new Date('2026-07-28T09:00:00.000Z'),
    });

    expect(result.status).toBe('success');
    expect(insertWorklogs).toHaveBeenCalled();
  });

  it('refuses an over-long comment and writes nothing', async () => {
    expect(await refusal({ ...valid, comment: 'x'.repeat(1001) })).toBe(
      'Comment is too long (max 1000 characters)',
    );
  });

  // @scenario absence/An over-long range is refused
  // The date picker accepts any year, and the range becomes one record per day.
  it('refuses a range longer than a year and writes nothing', async () => {
    expect(
      await refusal({
        ...valid,
        from: new Date('2026-01-01T00:00:00.000Z'),
        to: new Date('2027-01-02T00:00:00.000Z'),
      }),
    ).toBe('An absence range cannot be longer than 366 days');
  });

  it('accepts a range of exactly the maximum length', async () => {
    const result = await actions.onAbsenceSubmit({
      ...valid,
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(result.status).toBe('success');
  });

  // Settings carry the times every record is stored with, and their own format
  // check is looser than the worklog's: 99:99 passes it.
  it('refuses to write records the worklog rules would reject', async () => {
    getSettings.mockResolvedValue({ ...settings, toDefault: '99:99' });

    expect(await refusal(valid)).toBe(
      'Your default start and end times are invalid. Check settings.',
    );
  });
});

describe('onAbsenceSubmit range expansion', () => {
  // @scenario absence/Three-day absence
  // @scenario absence/Records use the user's configured default times
  it('hands the repository one record per day, at the configured times', async () => {
    const result = await actions.onAbsenceSubmit(valid);

    expect(result.status).toBe('success');

    expect(insertWorklogs).toHaveBeenCalledTimes(1);
    expect(insertWorklogs).toHaveBeenCalledWith([
      {
        from: new Date('2026-07-28T09:00:00.000Z'),
        to: new Date('2026-07-28T17:00:00.000Z'),
        comment: 'Away',
        subtractLunchBreak: true,
        absence: AbsenceReason.holiday,
      },
      {
        from: new Date('2026-07-29T09:00:00.000Z'),
        to: new Date('2026-07-29T17:00:00.000Z'),
        comment: 'Away',
        subtractLunchBreak: true,
        absence: AbsenceReason.holiday,
      },
      {
        from: new Date('2026-07-30T09:00:00.000Z'),
        to: new Date('2026-07-30T17:00:00.000Z'),
        comment: 'Away',
        subtractLunchBreak: true,
        absence: AbsenceReason.holiday,
      },
    ]);
  });

  it('writes a single record for a one-day range', async () => {
    await actions.onAbsenceSubmit({
      ...valid,
      to: valid.from,
    });

    expect(insertWorklogs).toHaveBeenCalledWith([
      expect.objectContaining({
        from: new Date('2026-07-28T09:00:00.000Z'),
        to: new Date('2026-07-28T17:00:00.000Z'),
      }),
    ]);
  });

  // The client sends days, not times: whatever time of day the picked dates
  // carry, the stored record uses the user's configured hours.
  it('ignores any time the client happens to send', async () => {
    await actions.onAbsenceSubmit({
      ...valid,
      from: new Date('2026-07-28T13:45:00.000Z'),
      to: new Date('2026-07-28T22:15:00.000Z'),
    });

    expect(insertWorklogs).toHaveBeenCalledWith([
      expect.objectContaining({
        from: new Date('2026-07-28T09:00:00.000Z'),
        to: new Date('2026-07-28T17:00:00.000Z'),
      }),
    ]);
  });

  it('refuses to guess the times when the user has no settings', async () => {
    getSettings.mockResolvedValue(null);

    expect(await refusal(valid)).toBe(
      'Your settings could not be loaded, so nothing was saved.',
    );
  });

  // @scenario absence/The message names the conflicting day
  // The rule lives in the repository, which raises it. The action turns it into
  // a returned message, because a raised one would not survive the trip to the
  // browser in a production build.
  it('returns the conflict the repository raised, message intact', async () => {
    insertWorklogs.mockRejectedValue(
      new AbsenceConflictError(['2026-07-30' as Date_ISODay]),
    );

    const result = await actions.onAbsenceSubmit(valid);

    expect(result).toEqual({
      status: 'error',
      message: 'An absence is already recorded for 30.7.2026.',
    });
  });

  // Anything else is not ours to show: it keeps travelling as a failure.
  it('lets an unexpected failure propagate', async () => {
    insertWorklogs.mockRejectedValue(new Error('connection reset'));

    await expect(actions.onAbsenceSubmit(valid)).rejects.toThrow(
      'connection reset',
    );
  });
});
