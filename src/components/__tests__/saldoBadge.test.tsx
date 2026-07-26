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
import type { Settings, Worklog } from '@/types';

// SaldoBadge is an async server component: awaited, then the element rendered.
//
// The arithmetic itself belongs to the service and is tested there. What is asserted
// here is the wiring — that the overrides are fetched and handed to the calculation,
// and that the sign of the result decides how the badge reads, since a negative
// balance shown as a positive one would be the most misleading bug in the app.
jest.mock('@/repository/expectedHoursOverrideRepository', () => ({
  getExpectedHoursOverrides: jest.fn(),
}));

type OverridesMock = jest.Mock<() => Promise<unknown[]>>;

let SaldoBadge: typeof import('../saldoBadge').default;
let getOverrides: OverridesMock;

beforeAll(async () => {
  SaldoBadge = (await import('../saldoBadge')).default;
  getOverrides = (await import('@/repository/expectedHoursOverrideRepository'))
    .getExpectedHoursOverrides as unknown as OverridesMock;
});

const time = (s: string) => s as Date_Time;

/** Settings whose accrual window starts today, so only what is worked counts. */
const settings = (overrides: Partial<Settings> = {}): Settings => ({
  id: 1,
  beginDate: new Date(),
  initialBalanceHours: 0,
  initialBalanceMins: 0,
  fromDefault: time('08:00'),
  toDefault: time('16:00'),
  expectedMinutesPerDay: 450,
  ...overrides,
});

beforeEach(() => {
  getOverrides.mockReset();
  getOverrides.mockResolvedValue([]);
});

const renderBadge = async (props: {
  settings: Settings;
  worklogs: Worklog[];
}) => {
  const element = await SaldoBadge(props);
  return render(element);
};

describe('SaldoBadge', () => {
  it('reads the overrides that the calculation depends on', async () => {
    await renderBadge({ settings: settings(), worklogs: [] });

    expect(getOverrides).toHaveBeenCalled();
  });

  it('shows a credit as a positive badge', async () => {
    await renderBadge({
      settings: settings({ initialBalanceHours: 2, initialBalanceMins: 30 }),
      worklogs: [],
    });

    const badge = screen.getByText('2h 30min');
    expect(badge).toHaveClass('badge-success');
    expect(badge).toHaveClass('badge-lg');
  });

  it('shows a debt as a negative badge', async () => {
    await renderBadge({
      settings: settings({ initialBalanceHours: -1, initialBalanceMins: -15 }),
      worklogs: [],
    });

    const badge = screen.getByText('-1h 15min');
    expect(badge).toHaveClass('badge-error');
  });
});
