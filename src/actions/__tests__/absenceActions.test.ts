import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';
import { AbsenceReason, type AbsenceData } from '@/types';

// Same harness as worklogActions.test.ts: repositories are mocked so the suite
// can show that a rejected absence never reaches a write, and the module under
// test is imported dynamically after the mocks exist.
jest.mock('@/repository/worklogRepository', () => ({
  insertWorklog: jest.fn(),
  insertWorklogs: jest.fn(),
  updateWorklog: jest.fn(),
  deleteWorklog: jest.fn(),
  getWorklogs: jest.fn(),
  getAbsenceDays: jest.fn(),
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

describe('onAbsenceSubmit validation', () => {
  it('rejects a missing reason and writes nothing', async () => {
    const noReason = { ...valid, reason: undefined };

    await expect(actions.onAbsenceSubmit(noReason)).rejects.toThrow(
      'Reason is required',
    );
    expect(insertWorklogs).not.toHaveBeenCalled();
  });

  it('rejects a missing from-date and writes nothing', async () => {
    const noFrom = { ...valid, from: null };

    await expect(actions.onAbsenceSubmit(noFrom)).rejects.toThrow(
      'From date is required',
    );
    expect(insertWorklogs).not.toHaveBeenCalled();
  });

  it('rejects a to-date before the from-date and writes nothing', async () => {
    const reversed = {
      ...valid,
      to: new Date('2026-07-27T00:00:00.000Z'),
    };

    await expect(actions.onAbsenceSubmit(reversed)).rejects.toThrow(
      'The to-date must not be before the from-date',
    );
    expect(insertWorklogs).not.toHaveBeenCalled();
  });

  it('rejects an over-long comment and writes nothing', async () => {
    const wordy = { ...valid, comment: 'x'.repeat(1001) };

    await expect(actions.onAbsenceSubmit(wordy)).rejects.toThrow(
      'Comment is too long (max 1000 characters)',
    );
    expect(insertWorklogs).not.toHaveBeenCalled();
  });
});

describe('onAbsenceSubmit range expansion', () => {
  // @scenario absence/Three-day absence
  // @scenario absence/Records use the user's configured default times
  it('hands the repository one record per day, at the configured times', async () => {
    await actions.onAbsenceSubmit(valid);

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

    await expect(actions.onAbsenceSubmit(valid)).rejects.toThrow(
      'Settings not found',
    );
    expect(insertWorklogs).not.toHaveBeenCalled();
  });

  // The rule itself lives in the repository; the action must let its message
  // through untouched so the toast can name the conflicting day.
  it('surfaces a conflict raised by the repository', async () => {
    insertWorklogs.mockRejectedValue(
      new Error('An absence is already recorded for 30.7.2026.'),
    );

    await expect(actions.onAbsenceSubmit(valid)).rejects.toThrow(
      'An absence is already recorded for 30.7.2026.',
    );
  });
});
