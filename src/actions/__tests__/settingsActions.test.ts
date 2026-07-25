import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';
import type { SettingsData } from '@/types';
import {
  DEFAULT_EXPECTED_MINUTES_PER_DAY,
  NEW_WORKLOG_DEFAULT_FROM,
  NEW_WORKLOG_DEFAULT_TO,
} from '@/constants';

// Repositories are mocked so this suite can assert the half a schema test
// cannot: that a rejected settings update never reaches the settings row.
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
let upsertSettings: ResolvingMock;
let insertSettings: ResolvingMock;
let upsertUser: ResolvingMock;
let upsertExpectedHoursOverride: ResolvingMock;

const valid: SettingsData = {
  beginDate: new Date('2026-02-01T00:00:00.000Z'),
  initialBalanceHours: 1,
  initialBalanceMins: 15,
  fromDefault: '08:00' as SettingsData['fromDefault'],
  toDefault: '16:00' as SettingsData['toDefault'],
  expectedMinutesPerDay: 450,
};

beforeAll(async () => {
  actions = await import('@/actions');
  const settingsRepo = await import('@/repository/settingsRepository');
  const userRepo = await import('@/repository/userRepository');
  const overrideRepo =
    await import('@/repository/expectedHoursOverrideRepository');
  upsertSettings = settingsRepo.upsertSettings as unknown as ResolvingMock;
  insertSettings = settingsRepo.insertSettings as unknown as ResolvingMock;
  upsertUser = userRepo.upsertUser as unknown as ResolvingMock;
  upsertExpectedHoursOverride =
    overrideRepo.upsertExpectedHoursOverride as unknown as ResolvingMock;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('onSettingsUpdate validation', () => {
  // @scenario settings/From after to is rejected
  // @scenario settings/Inverted default times rejected
  it('rejects a default from-time after the to-time and changes nothing', async () => {
    await expect(
      actions.onSettingsUpdate({
        ...valid,
        fromDefault: '17:00' as SettingsData['fromDefault'],
        toDefault: '09:00' as SettingsData['toDefault'],
      }),
    ).rejects.toThrow('From time must be before to time');
    expect(upsertSettings).not.toHaveBeenCalled();
  });

  // @scenario settings/Inverted default times rejected
  it('rejects equal default times and changes nothing', async () => {
    await expect(
      actions.onSettingsUpdate({
        ...valid,
        fromDefault: '09:00' as SettingsData['fromDefault'],
        toDefault: '09:00' as SettingsData['toDefault'],
      }),
    ).rejects.toThrow('From time must be before to time');
    expect(upsertSettings).not.toHaveBeenCalled();
  });

  // @scenario settings/Missing begin date rejected
  it('rejects a missing begin date and changes nothing', async () => {
    const missing = { ...valid, beginDate: undefined };

    await expect(
      actions.onSettingsUpdate(missing as unknown as SettingsData),
    ).rejects.toThrow('Begin date is required');
    expect(upsertSettings).not.toHaveBeenCalled();
  });

  // @scenario settings/Out-of-range initial balance rejected
  it('rejects initial-balance minutes above 59 and changes nothing', async () => {
    await expect(
      actions.onSettingsUpdate({ ...valid, initialBalanceMins: 60 }),
    ).rejects.toThrow('Minutes must be between 0 and 59');
    expect(upsertSettings).not.toHaveBeenCalled();
  });

  // @scenario settings/Out-of-range initial balance rejected
  it('rejects initial-balance hours beyond the allowed bound', async () => {
    await expect(
      actions.onSettingsUpdate({ ...valid, initialBalanceHours: 10001 }),
    ).rejects.toThrow('Hours out of range');
    expect(upsertSettings).not.toHaveBeenCalled();
  });

  // @scenario settings/Out-of-range expected minutes per day rejected
  it('rejects negative expected minutes per day and changes nothing', async () => {
    await expect(
      actions.onSettingsUpdate({ ...valid, expectedMinutesPerDay: -1 }),
    ).rejects.toThrow('Expected hours must be between 0 and 24');
    expect(upsertSettings).not.toHaveBeenCalled();
  });

  // @scenario settings/Out-of-range expected minutes per day rejected
  it('rejects expected minutes per day beyond a full day', async () => {
    await expect(
      actions.onSettingsUpdate({
        ...valid,
        expectedMinutesPerDay: 24 * 60 + 1,
      }),
    ).rejects.toThrow('Expected hours must be between 0 and 24');
    expect(upsertSettings).not.toHaveBeenCalled();
  });

  // @scenario settings/Valid settings pass
  it('persists settings that satisfy every rule', async () => {
    upsertSettings.mockResolvedValue({ id: 5 });

    await expect(actions.onSettingsUpdate(valid)).resolves.toEqual({ id: 5 });
    expect(upsertSettings).toHaveBeenCalledWith(valid);
  });
});

describe('onAfterSignin', () => {
  // @scenario settings/Seed on first sign-in
  it('seeds settings with a start-of-today begin date, zero balance and defaults', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-04T13:45:00.000Z').getTime());
    upsertUser.mockResolvedValue({ id: 7, email: 'new@example.com' });
    insertSettings.mockResolvedValue({ id: 9 });

    await actions.onAfterSignin({
      email: 'new@example.com',
      name: 'New User',
    } as Parameters<Actions['onAfterSignin']>[0]);

    expect(insertSettings).toHaveBeenCalledWith({
      userId: 7,
      beginDate: new Date('2026-03-04T00:00:00.000Z'),
      initialBalanceHours: 0,
      initialBalanceMins: 0,
      fromDefault: NEW_WORKLOG_DEFAULT_FROM,
      toDefault: NEW_WORKLOG_DEFAULT_TO,
      expectedMinutesPerDay: DEFAULT_EXPECTED_MINUTES_PER_DAY,
    });
    jest.useRealTimers();
  });
});

describe('onExpectedHoursOverrideUpsert validation', () => {
  // @scenario expected-hours/Negative minutes rejected
  it('rejects negative minutes and persists nothing', async () => {
    await expect(
      actions.onExpectedHoursOverrideUpsert({
        date: new Date('2026-12-23T00:00:00.000Z'),
        minutes: -1,
        label: undefined,
      }),
    ).rejects.toThrow('Expected hours must be between 0 and 24');
    expect(upsertExpectedHoursOverride).not.toHaveBeenCalled();
  });
});
