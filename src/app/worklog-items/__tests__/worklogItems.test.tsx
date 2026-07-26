import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Date_Time } from '@/util/dateFormatter';
import type { Settings, Worklog } from '@/types';

// This component's own work is grouping: by day, then by month, with anything ahead
// of today held in a separate "Future worklogs" group and anything before the begin
// date dimmed because it does not count. Those rules decide what a user believes
// their history is, and none of them are visible to a test that only reads one month.
//
// WorklogItem is stubbed down to the two callbacks it invokes, so the local-state
// bookkeeping after a delete or an edit can be driven directly. The row itself has
// its own test.
jest.mock('@/components/worklogItem/worklogItem', () => ({
  __esModule: true,
  default: ({
    worklog,
    ignored,
    onDelete,
    onEdit,
  }: {
    worklog: Worklog;
    ignored?: boolean;
    onDelete: (id: number) => void;
    onEdit: (edited: Worklog) => void;
  }) => (
    <div
      data-testid={`row-${worklog.id}`}
      data-ignored={ignored ? 'yes' : 'no'}
    >
      <span>{worklog.comment}</span>
      <button onClick={() => onDelete(worklog.id)}>delete-{worklog.id}</button>
      <button onClick={() => onEdit({ ...worklog, comment: 'edited' })}>
        edit-{worklog.id}
      </button>
    </div>
  ),
}));

let WorklogItems: typeof import('../worklogItems').default;

beforeAll(async () => {
  WorklogItems = (await import('../worklogItems')).default;
});

const time = (s: string) => s as Date_Time;

/** A day offset from today, at a fixed hour so the entry is comfortably inside it. */
const dayOffset = (days: number, hour = 9) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

const worklog = (id: number, from: Date, comment: string): Worklog => ({
  id,
  from,
  to: new Date(from.getTime() + 8 * 60 * 60 * 1000),
  subtractLunchBreak: false,
  absence: null,
  comment,
});

const settings = (beginDate: Date): Settings => ({
  id: 1,
  beginDate,
  initialBalanceHours: 0,
  initialBalanceMins: 0,
  fromDefault: time('08:00'),
  toDefault: time('16:00'),
  expectedMinutesPerDay: 450,
});

describe('WorklogItems', () => {
  it('keeps entries ahead of today out of the monthly groups', () => {
    render(
      <WorklogItems
        worklogs={[
          worklog(1, dayOffset(-1), 'yesterday'),
          worklog(2, dayOffset(30), 'next month'),
        ]}
        settings={settings(dayOffset(-90))}
      />,
    );

    expect(screen.getByText('Future worklogs')).toBeInTheDocument();
    expect(screen.getByTestId('row-1')).toBeInTheDocument();
    expect(screen.getByTestId('row-2')).toBeInTheDocument();
  });

  it('groups several entries on one day together', () => {
    render(
      <WorklogItems
        worklogs={[
          worklog(1, dayOffset(-1, 8), 'morning'),
          worklog(2, dayOffset(-1, 13), 'afternoon'),
        ]}
        settings={settings(dayOffset(-90))}
      />,
    );

    // One date badge for the day, two rows under it.
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(2);
  });

  it('dims a day that falls before the balance began', () => {
    render(
      <WorklogItems
        worklogs={[
          worklog(1, dayOffset(-30), 'before'),
          worklog(2, dayOffset(-1), 'after'),
        ]}
        settings={settings(dayOffset(-7))}
      />,
    );

    expect(screen.getByTestId('row-1')).toHaveAttribute('data-ignored', 'yes');
    expect(screen.getByTestId('row-2')).toHaveAttribute('data-ignored', 'no');
  });

  it('drops a deleted row once the server data catches up', async () => {
    const both = [
      worklog(1, dayOffset(-1), 'first'),
      worklog(2, dayOffset(-1), 'second'),
    ];
    const { rerender } = render(
      <WorklogItems worklogs={both} settings={settings(dayOffset(-90))} />,
    );

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'delete-1' }));

    // Documenting current behaviour, not endorsing it: the local removal is undone
    // immediately, because the length resync sees `worklogs` still holding two and
    // overwrites the shortened state. The row only goes when router.refresh() has
    // re-rendered the parent with one fewer worklog — so the optimistic update is
    // dead code and the refresh is what the user actually waits for.
    expect(screen.getByTestId('row-1')).toBeInTheDocument();

    rerender(
      <WorklogItems worklogs={[both[1]]} settings={settings(dayOffset(-90))} />,
    );

    expect(screen.queryByTestId('row-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('row-2')).toBeInTheDocument();
  });

  it('shows the new value of an edited row in place', async () => {
    render(
      <WorklogItems
        worklogs={[worklog(1, dayOffset(-1), 'before edit')]}
        settings={settings(dayOffset(-90))}
      />,
    );

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'edit-1' }));

    expect(screen.getByText('edited')).toBeInTheDocument();
    expect(screen.queryByText('before edit')).not.toBeInTheDocument();
  });

  it('picks up an entry added elsewhere on the page', () => {
    const { rerender } = render(
      <WorklogItems
        worklogs={[worklog(1, dayOffset(-1), 'first')]}
        settings={settings(dayOffset(-90))}
      />,
    );
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(1);

    // Quick-add inserts a worklog without remounting this list, which is what the
    // length resync in the component exists for.
    rerender(
      <WorklogItems
        worklogs={[
          worklog(1, dayOffset(-1), 'first'),
          worklog(2, dayOffset(-1), 'added by quick-add'),
        ]}
        settings={settings(dayOffset(-90))}
      />,
    );

    expect(screen.getAllByTestId(/^row-/)).toHaveLength(2);
  });
});
