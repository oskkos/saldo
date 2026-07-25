import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { AbsenceReason, type Settings, type Worklog } from '@/types';

// Statistics is an async server component: it is awaited and the returned
// element rendered. Its reads are mocked at the repository boundary, and the
// chart is stubbed because react-chartjs-2 needs a canvas jsdom does not have
// — the stub echoes the series so the page's own output is what is asserted.
jest.mock('@/auth/authSession', () => ({ getUserFromSession: jest.fn() }));
jest.mock('@/repository/worklogRepository', () => ({ getWorklogs: jest.fn() }));
jest.mock('@/repository/settingsRepository', () => ({
  getSettings: jest.fn(),
}));
jest.mock('../workMinutesPerDayChart', () => ({
  __esModule: true,
  default: ({
    workMinutesPerDay,
  }: {
    workMinutesPerDay: Map<string, number>;
  }) => (
    <div
      data-testid="chart"
      data-series={JSON.stringify(Array.from(workMinutesPerDay))}
    />
  ),
}));

type ResolvingMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

let Statistics: typeof import('../page').default;
let getUserFromSession: ResolvingMock;
let getWorklogs: ResolvingMock;
let getSettings: ResolvingMock;

const BEGIN = new Date('2026-06-01T00:00:00.000Z');

const settings = { beginDate: BEGIN } as Settings;

const work = (from: string, to: string): Worklog =>
  ({
    id: 1,
    from: new Date(from),
    to: new Date(to),
    comment: '',
    subtractLunchBreak: false,
    absence: null,
  }) as Worklog;

const absence = (day: string, reason: AbsenceReason): Worklog =>
  ({
    id: 2,
    from: new Date(`${day}T08:00:00.000Z`),
    to: new Date(`${day}T16:00:00.000Z`),
    comment: '',
    subtractLunchBreak: false,
    absence: reason,
  }) as Worklog;

const renderStatistics = async () => {
  const element = await Statistics();
  return element === null ? null : render(element);
};

const series = () =>
  JSON.parse(screen.getByTestId('chart').getAttribute('data-series') ?? '[]');

const valueFor = (label: string) =>
  screen.getByText(label).nextElementSibling?.textContent;

beforeAll(async () => {
  Statistics = (await import('../page')).default;
  const auth = await import('@/auth/authSession');
  const worklogRepo = await import('@/repository/worklogRepository');
  const settingsRepo = await import('@/repository/settingsRepository');
  getUserFromSession = auth.getUserFromSession as unknown as ResolvingMock;
  getWorklogs = worklogRepo.getWorklogs as unknown as ResolvingMock;
  getSettings = settingsRepo.getSettings as unknown as ResolvingMock;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-06-30T20:00:00.000Z').getTime());
  getUserFromSession.mockResolvedValue({ id: 42, email: 'a@b.c', name: 'A' });
  getSettings.mockResolvedValue(settings);
  getWorklogs.mockResolvedValue([]);
});

describe('Statistics', () => {
  // @scenario statistics/No session or no settings
  it('renders nothing without an authenticated user', async () => {
    getUserFromSession.mockResolvedValue(null);

    await expect(renderStatistics()).resolves.toBeNull();
  });

  // @scenario statistics/No session or no settings
  it('renders nothing when the user has no settings', async () => {
    getSettings.mockResolvedValue(null);

    await expect(renderStatistics()).resolves.toBeNull();
  });

  // @scenario statistics/Out-of-window entries excluded
  it('excludes entries before the begin date and in the future', async () => {
    getWorklogs.mockResolvedValue([
      work('2026-05-31T08:00:00.000Z', '2026-05-31T16:00:00.000Z'), // before
      work('2026-06-02T08:00:00.000Z', '2026-06-02T10:00:00.000Z'), // in window
      work('2026-07-01T08:00:00.000Z', '2026-07-01T16:00:00.000Z'), // future
    ]);

    await renderStatistics();

    // Only the in-window entry reaches any figure.
    expect(series()).toEqual([['2026-06-02', 120]]);
    expect(valueFor('Total hours logged')).toBe('2h 0min');
  });

  // @scenario statistics/Absences excluded from hours totals
  it('leaves absences out of the total and average hours', async () => {
    getWorklogs.mockResolvedValue([
      work('2026-06-02T08:00:00.000Z', '2026-06-02T10:00:00.000Z'),
      absence('2026-06-03', AbsenceReason.holiday),
    ]);

    await renderStatistics();

    expect(valueFor('Total hours logged')).toBe('2h 0min');
    // One logged work day, so the average equals that day's total.
    expect(valueFor('Avg hours per day')).toBe('2h 0min');
    expect(series()).toEqual([['2026-06-02', 120]]);
  });

  // @scenario statistics/Totals and extremes
  it('sums work minutes and identifies the highest and lowest days', async () => {
    getWorklogs.mockResolvedValue([
      work('2026-06-02T08:00:00.000Z', '2026-06-02T10:00:00.000Z'), // 120
      work('2026-06-03T08:00:00.000Z', '2026-06-03T15:00:00.000Z'), // 420
      work('2026-06-04T08:00:00.000Z', '2026-06-04T09:00:00.000Z'), // 60
    ]);

    await renderStatistics();

    expect(valueFor('Total hours logged')).toBe('10h 0min');
    expect(valueFor('Most hours per day')).toContain('7h 0min');
    expect(valueFor('Most hours per day')).toContain('3.6.2026');
    expect(valueFor('Least hours per day')).toContain('1h 0min');
    expect(valueFor('Least hours per day')).toContain('4.6.2026');
  });

  // @scenario statistics/Absence tally
  it('counts each absence reason on working days only', async () => {
    getWorklogs.mockResolvedValue([
      absence('2026-06-02', AbsenceReason.holiday), // Tue
      absence('2026-06-03', AbsenceReason.holiday), // Wed
      absence('2026-06-04', AbsenceReason.sick_leave), // Thu
      absence('2026-06-06', AbsenceReason.holiday), // Saturday — not counted
    ]);

    const view = await renderStatistics();

    const tally = view!.container.querySelector(
      '.grid-cols-\\[6rem_auto\\]',
    )?.textContent;
    expect(tally).toBe('Holiday2Sick leave1');
  });

  // @scenario statistics/Chart renders
  it('shows a per-day chart when there are in-window work entries', async () => {
    getWorklogs.mockResolvedValue([
      work('2026-06-02T08:00:00.000Z', '2026-06-02T10:00:00.000Z'),
      work('2026-06-03T08:00:00.000Z', '2026-06-03T11:00:00.000Z'),
    ]);

    await renderStatistics();

    expect(screen.getByTestId('chart')).toBeInTheDocument();
    expect(series()).toEqual([
      ['2026-06-02', 120],
      ['2026-06-03', 180],
    ]);
  });

  // @scenario statistics/Worklog near UTC midnight
  it('groups an entry near UTC midnight under its UTC date', async () => {
    // The suite runs in a non-UTC zone (America/New_York), where 00:30 UTC on
    // the 3rd is still the evening of the 2nd. Grouping must not follow that.
    getWorklogs.mockResolvedValue([
      work('2026-06-03T00:30:00.000Z', '2026-06-03T01:30:00.000Z'),
      work('2026-06-02T23:30:00.000Z', '2026-06-02T23:59:00.000Z'),
    ]);

    await renderStatistics();

    expect(series()).toEqual([
      ['2026-06-03', 60],
      ['2026-06-02', 29],
    ]);
  });
});
