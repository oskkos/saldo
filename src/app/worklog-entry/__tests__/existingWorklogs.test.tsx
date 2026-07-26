import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import type { Worklog } from '@/types';

// A thin wrapper, but it holds the day's total — the figure a user checks before
// deciding whether they still owe time today. It also renders nothing at all for an
// empty day rather than an empty heading with a zero badge.
jest.mock('@/components/worklogItem/worklogItem', () => ({
  __esModule: true,
  default: ({ worklog }: { worklog: Worklog }) => <div>row-{worklog.id}</div>,
}));

let ExistingWorklogs: typeof import('../existingWorklogs').default;

beforeAll(async () => {
  ExistingWorklogs = (await import('../existingWorklogs')).default;
});

const worklog = (id: number, hours: number): Worklog => ({
  id,
  from: new Date('2026-07-26T08:00:00Z'),
  to: new Date(`2026-07-26T${String(8 + hours).padStart(2, '0')}:00:00Z`),
  subtractLunchBreak: false,
  absence: null,
  comment: null,
});

const renderList = (worklogs: Worklog[]) =>
  render(
    <ExistingWorklogs
      worklogs={worklogs}
      onDelete={jest.fn()}
      onEdit={jest.fn()}
    />,
  );

describe('ExistingWorklogs', () => {
  it('renders nothing for a day with no entries', () => {
    const { container } = renderList([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('lists the entries and totals their time', () => {
    renderList([worklog(1, 3), worklog(2, 5)]);

    expect(screen.getByText('Existing worklogs for day')).toBeInTheDocument();
    expect(screen.getByText('row-1')).toBeInTheDocument();
    expect(screen.getByText('row-2')).toBeInTheDocument();
    // Three hours plus five, shown as the day's running total.
    expect(screen.getByText('8h 0min')).toBeInTheDocument();
  });
});
