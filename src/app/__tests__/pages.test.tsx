import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { render, screen } from '@testing-library/react';

import type { Date_Time } from '@/util/dateFormatter';
import type { ExpectedHoursOverride, Settings, Worklog } from '@/types';

// The route entry points: async server components that read, assert what must exist,
// and hand the result to a client component. Their own logic is the reading and the
// picking — which override belongs to the requested day, and what happens when a user
// has no settings row yet. Each returns a thin tree, so the children are stubbed to
// report the props they were given.
jest.mock('@/repository/worklogRepository', () => ({ getWorklogs: jest.fn() }));
jest.mock('@/repository/settingsRepository', () => ({
  getSettings: jest.fn(),
}));
jest.mock('@/repository/expectedHoursOverrideRepository', () => ({
  getExpectedHoursOverrides: jest.fn(),
}));
jest.mock('@/actions', () => ({ onWorklogSubmit: jest.fn() }));
jest.mock('../worklog-items/worklogItems', () => ({
  __esModule: true,
  default: ({ worklogs }: { worklogs: Worklog[] }) => (
    <div>{`items:${worklogs.map((w) => w.id).join(',')}`}</div>
  ),
}));
jest.mock('../worklog-entry/worklogEntry', () => ({
  __esModule: true,
  default: ({
    day,
    expectedMinutes,
    override,
  }: {
    day: string;
    expectedMinutes: number;
    override: ExpectedHoursOverride | null;
    // One interpolated string, so the assertion is not defeated by JSX splitting the
    // value into separate text nodes.
  }) => (
    <div>{`entry:${day}:${expectedMinutes}:${override ? override.id : 'no-override'}`}</div>
  ),
}));
jest.mock('../settings/settings', () => ({
  __esModule: true,
  default: () => <div>settings-form</div>,
}));
jest.mock('../settings/expectedHoursOverrides', () => ({
  __esModule: true,
  default: ({ overrides }: { overrides: ExpectedHoursOverride[] }) => (
    <div>{`overrides:${overrides.length}`}</div>
  ),
}));

type ResolvingMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

let WorklogItemsPage: () => Promise<React.ReactElement>;
let WorklogEntryPage: (props: {
  searchParams: Promise<{ day: string }>;
}) => Promise<React.ReactElement>;
let SettingsPage: () => Promise<React.ReactElement>;
let getWorklogs: ResolvingMock;
let getSettings: ResolvingMock;
let getOverrides: ResolvingMock;

beforeAll(async () => {
  WorklogItemsPage = (await import('../worklog-items/page')).default;
  WorklogEntryPage = (await import('../worklog-entry/page')).default;
  SettingsPage = (await import('../settings/page')).default;
  getWorklogs = (await import('@/repository/worklogRepository'))
    .getWorklogs as unknown as ResolvingMock;
  getSettings = (await import('@/repository/settingsRepository'))
    .getSettings as unknown as ResolvingMock;
  getOverrides = (await import('@/repository/expectedHoursOverrideRepository'))
    .getExpectedHoursOverrides as unknown as ResolvingMock;
});

const time = (s: string) => s as Date_Time;

const settings: Settings = {
  id: 1,
  beginDate: new Date('2026-01-01T00:00:00Z'),
  initialBalanceHours: 0,
  initialBalanceMins: 0,
  fromDefault: time('08:00'),
  toDefault: time('16:00'),
  expectedMinutesPerDay: 450,
};

const worklog = (id: number, from: string): Worklog => ({
  id,
  from: new Date(from),
  to: new Date(from),
  subtractLunchBreak: false,
  absence: null,
  comment: null,
});

beforeEach(() => {
  getWorklogs.mockReset();
  getSettings.mockReset();
  getOverrides.mockReset();
  getSettings.mockResolvedValue(settings);
  getWorklogs.mockResolvedValue([]);
  getOverrides.mockResolvedValue([]);
});

describe('WorklogItemsPage', () => {
  it('hands the worklogs down in order', async () => {
    getWorklogs.mockResolvedValue([
      worklog(2, '2026-07-02T08:00:00Z'),
      worklog(1, '2026-07-01T08:00:00Z'),
    ]);

    render(await WorklogItemsPage());

    // Sorted before rendering, newest first.
    expect(screen.getByText('items:2,1')).toBeInTheDocument();
  });

  it('refuses to render for a user with no settings', async () => {
    getSettings.mockResolvedValue(null);

    await expect(WorklogItemsPage()).rejects.toThrow();
  });
});

describe('WorklogEntryPage', () => {
  const renderDay = async (day: string) =>
    render(await WorklogEntryPage({ searchParams: Promise.resolve({ day }) }));

  it('passes a working day through with the default expectation', async () => {
    // A Monday: the default applies.
    await renderDay('2026-07-27');

    expect(
      screen.getByText('entry:2026-07-27:450:no-override'),
    ).toBeInTheDocument();
  });

  it('expects nothing on a non-working day', async () => {
    // A Sunday. Carrying the weekday default onto a weekend would make every
    // Saturday and Sunday look like a 7.5-hour debt.
    await renderDay('2026-07-26');

    expect(
      screen.getByText('entry:2026-07-26:0:no-override'),
    ).toBeInTheDocument();
  });

  it('picks the override belonging to the day being viewed', async () => {
    getOverrides.mockResolvedValue([
      {
        id: 5,
        date: new Date('2026-07-27T00:00:00Z'),
        minutes: 240,
        label: null,
      },
      {
        id: 6,
        date: new Date('2026-07-28T00:00:00Z'),
        minutes: 120,
        label: null,
      },
    ]);

    await renderDay('2026-07-27');

    // The day's own override, at its minutes — not the next day's.
    expect(screen.getByText('entry:2026-07-27:240:5')).toBeInTheDocument();
  });

  it('refuses a day that is not a date', async () => {
    await expect(
      WorklogEntryPage({ searchParams: Promise.resolve({ day: 'tomorrow' }) }),
    ).rejects.toThrow();
  });
});

describe('SettingsPage', () => {
  it('shows the form and the special days together', async () => {
    getOverrides.mockResolvedValue([
      {
        id: 1,
        date: new Date('2026-07-26T00:00:00Z'),
        minutes: 240,
        label: null,
      },
    ]);

    render(await SettingsPage());

    expect(screen.getByText('settings-form')).toBeInTheDocument();
    expect(screen.getByText('overrides:1')).toBeInTheDocument();
  });

  it('refuses to render for a user with no settings', async () => {
    getSettings.mockResolvedValue(null);

    await expect(SettingsPage()).rejects.toThrow();
  });
});
