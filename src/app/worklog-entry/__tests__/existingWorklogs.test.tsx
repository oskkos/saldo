import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { AbsenceReason, type Worklog } from '@/types';

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

  // @scenario saldo/A day with an absence and real hours
  it('leaves an absence out of the day total', () => {
    const holiday: Worklog = {
      id: 3,
      from: new Date('2026-07-26T08:00:00Z'),
      to: new Date('2026-07-26T16:00:00Z'),
      subtractLunchBreak: true,
      absence: AbsenceReason.holiday,
      comment: null,
    };
    const worked: Worklog = {
      id: 4,
      from: new Date('2026-07-26T08:00:00Z'),
      to: new Date('2026-07-26T14:00:00Z'),
      subtractLunchBreak: true,
      absence: null,
      comment: null,
    };

    renderList([worked, holiday]);

    // The absence carries 7h30 of stored time of its own. Counting it would
    // report 13h for a day on which five and a half hours were worked.
    expect(screen.getByText('5h 30min')).toBeInTheDocument();
    expect(screen.queryByText('13h 0min')).toBeNull();
    // It is still listed as an entry; only the total leaves it out.
    expect(screen.getByText('row-3')).toBeInTheDocument();
  });

  // @scenario saldo/A day with only an absence
  it('totals a day that holds nothing but an absence as zero', () => {
    renderList([
      {
        id: 5,
        from: new Date('2026-07-26T08:00:00Z'),
        to: new Date('2026-07-26T16:00:00Z'),
        subtractLunchBreak: true,
        absence: AbsenceReason.sick_leave,
        comment: null,
      },
    ]);

    expect(screen.getByText('0h 0min')).toBeInTheDocument();
  });
});
