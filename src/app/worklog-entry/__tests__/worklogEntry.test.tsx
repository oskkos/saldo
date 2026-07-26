import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import type { Date_ISODay, Date_Time } from '@/util/dateFormatter';
import type { Worklog, WorklogFormData } from '@/types';

// The day view's own work is turning the form's day-and-time strings into real dates
// before submitting, keeping the day's list current afterwards, and offering the
// neighbouring days. The submit path validates first: a malformed time raises before
// the action is reached, which the browser suite cannot produce because the inputs
// only ever hold valid values there.
//
// The children are stubbed to what this component actually interacts with; each has
// its own test.
jest.mock('../dayExpectedOverride', () => ({
  __esModule: true,
  default: () => <div>expected-override</div>,
}));
jest.mock('../existingWorklogs', () => ({
  __esModule: true,
  default: ({
    worklogs,
    onDelete,
  }: {
    worklogs: Worklog[];
    onDelete: (id: number) => void;
  }) => (
    <div>
      <span>existing:{worklogs.length}</span>
      {worklogs.map((w) => (
        <button key={w.id} onClick={() => onDelete(w.id)}>
          drop-{w.id}
        </button>
      ))}
    </div>
  ),
}));

let WorklogEntry: typeof import('../worklogEntry').default;
let ToastContext: typeof import('@/components/toastContext').ToastContext;

beforeAll(async () => {
  WorklogEntry = (await import('../worklogEntry')).default;
  ToastContext = (await import('@/components/toastContext')).ToastContext;
});

const day = '2026-07-26' as Date_ISODay;
const time = (s: string) => s as Date_Time;
const setMsg = jest.fn<(msg: unknown) => void>();
const onSubmit = jest.fn<(value: WorklogFormData) => Promise<Worklog>>();

const created = (id: number): Worklog => ({
  id,
  from: new Date('2026-07-26T08:00:00Z'),
  to: new Date('2026-07-26T16:00:00Z'),
  subtractLunchBreak: false,
  absence: null,
  comment: null,
});

/**
 * The toast the component asked for, rendered on its own so its text can be read.
 *
 * The returned queries are bound to that render, not to the document — asserting
 * through `screen` here would also search the component's own tree, so a message that
 * happened to appear in both would pass for the wrong reason.
 */
const shownToast = () => {
  const [msg] = setMsg.mock.calls[0] as [{ type: string; message: ReactNode }];
  const { getByText } = render(<>{msg.message}</>);
  return { type: msg.type, getByText };
};

const renderEntry = (worklogs: Worklog[] = []) =>
  render(
    <ToastContext.Provider value={{ msg: null, setMsg }}>
      <WorklogEntry
        day={day}
        defaults={{ fromDefault: time('08:00'), toDefault: time('16:00') }}
        worklogs={worklogs}
        onSubmit={onSubmit}
        expectedMinutes={450}
        override={null}
      />
    </ToastContext.Provider>,
  );

const submit = () =>
  userEvent.setup().click(screen.getByRole('button', { name: 'Submit' }));

beforeEach(() => {
  onSubmit.mockReset();
  setMsg.mockReset();
});

describe('WorklogEntry', () => {
  it('offers the neighbouring days', () => {
    renderEntry();

    expect(screen.getByTitle('Yesterday').closest('a')).toHaveAttribute(
      'href',
      '/worklog-entry?day=2026-07-25',
    );
    expect(screen.getByTitle('Tomorrow').closest('a')).toHaveAttribute(
      'href',
      '/worklog-entry?day=2026-07-27',
    );
  });

  it('shows the day it is editing and the entries already on it', () => {
    renderEntry([created(1)]);

    expect(screen.getByText('26.7.2026')).toBeInTheDocument();
    expect(screen.getByText('existing:1')).toBeInTheDocument();
  });

  it('submits the form times as dates on that day', async () => {
    onSubmit.mockResolvedValue(created(9));
    renderEntry();

    await submit();

    // The day and the times arrive as separate strings and have to be combined; a
    // worklog stamped on the wrong day is the failure this guards.
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.from.toISOString()).toContain('2026-07-26');
    expect(submitted.to.toISOString()).toContain('2026-07-26');
    const toast = shownToast();
    expect(toast.type).toBe('success');
    expect(toast.getByText('Worklog created')).toBeInTheDocument();
  });

  it('adds what was created to the day without a reload', async () => {
    onSubmit.mockResolvedValue(created(9));
    renderEntry();
    expect(screen.getByText('existing:0')).toBeInTheDocument();

    await submit();

    expect(await screen.findByText('existing:1')).toBeInTheDocument();
  });

  it('reports the reason when the server refuses', async () => {
    onSubmit.mockRejectedValue(new Error('overlaps an existing worklog'));
    renderEntry();

    await submit();

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(toast.getByText('Failed to create worklog')).toBeInTheDocument();
    expect(toast.getByText('overlaps an existing worklog')).toBeInTheDocument();
  });

  it('omits a detail line when the failure carries no message', async () => {
    onSubmit.mockRejectedValue('a bare string');
    renderEntry();

    await submit();

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.getByText('Failed to create worklog')).toBeInTheDocument();
  });

  it('takes a removed entry out of the day', async () => {
    renderEntry([created(1), created(2)]);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'drop-1' }));

    expect(screen.getByText('existing:1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'drop-1' })).toBeNull();
  });
});
