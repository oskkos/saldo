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

import type { Date_ISODay } from '@/util/dateFormatter';
import type { ExpectedHoursOverride } from '@/types';

// Setting a day's expected hours from the day view. Two rules live here and nowhere
// else: Clear is offered only when there is something to clear, and opening the
// dialog resets the fields to the day's current values so a cancelled edit does not
// linger and get saved by accident next time.
jest.mock('@/actions', () => ({
  onExpectedHoursOverrideUpsert: jest.fn(),
  onExpectedHoursOverrideDelete: jest.fn(),
}));
jest.mock('@/components/modal', () => {
  const actual =
    jest.requireActual<typeof import('@/components/modal')>(
      '@/components/modal',
    );
  return {
    __esModule: true,
    default: actual.default,
    showModal: jest.fn(),
    closeModal: jest.fn(),
  };
});

type ActionMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

let DayExpectedOverride: typeof import('../dayExpectedOverride').default;
let ToastContext: typeof import('@/components/toastContext').ToastContext;
let upsert: ActionMock;
let remove: ActionMock;

beforeAll(async () => {
  DayExpectedOverride = (await import('../dayExpectedOverride')).default;
  ToastContext = (await import('@/components/toastContext')).ToastContext;
  const actions = await import('@/actions');
  upsert = actions.onExpectedHoursOverrideUpsert as unknown as ActionMock;
  remove = actions.onExpectedHoursOverrideDelete as unknown as ActionMock;
});

const day = '2026-07-26' as Date_ISODay;
const setMsg = jest.fn<(msg: unknown) => void>();

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

const renderOverride = (
  override: ExpectedHoursOverride | null = null,
  expectedMinutes = 450,
) =>
  render(
    <ToastContext.Provider value={{ msg: null, setMsg }}>
      <DayExpectedOverride
        day={day}
        expectedMinutes={expectedMinutes}
        override={override}
      />
    </ToastContext.Provider>,
  );

const button = (name: string) =>
  screen.getByRole('button', { name, hidden: true });

beforeEach(() => {
  upsert.mockReset();
  remove.mockReset();
  setMsg.mockReset();
});

describe('DayExpectedOverride', () => {
  it('shows the day expectation, marking it when it is custom', () => {
    const { unmount } = renderOverride();
    expect(screen.getByText(/Expected today: 7h 30min/)).toBeInTheDocument();
    expect(screen.queryByText(/custom/)).not.toBeInTheDocument();
    unmount();

    renderOverride(
      {
        id: 1,
        date: new Date('2026-07-26T00:00:00Z'),
        minutes: 240,
        label: 'Short day',
      },
      240,
    );
    expect(screen.getByText(/custom/)).toBeInTheDocument();
  });

  it('offers Clear only when there is an override to clear', () => {
    const { unmount } = renderOverride();
    expect(
      screen.queryByRole('button', { name: 'Clear', hidden: true }),
    ).toBeNull();
    unmount();

    renderOverride(
      {
        id: 1,
        date: new Date('2026-07-26T00:00:00Z'),
        minutes: 240,
        label: null,
      },
      240,
    );
    expect(button('Clear')).toBeInTheDocument();
  });

  it('resets the fields to the day when reopened', async () => {
    renderOverride(null, 450);
    const user = userEvent.setup();

    // Type something, then reopen without saving.
    await user.clear(screen.getByPlaceholderText('hh'));
    await user.type(screen.getByPlaceholderText('hh'), '3');
    expect(screen.getByPlaceholderText('hh')).toHaveValue(3);

    await user.click(screen.getByTitle('Edit'));

    // Back to the day's real expectation, so a cancelled edit cannot be saved later.
    expect(screen.getByPlaceholderText('hh')).toHaveValue(7);
    expect(screen.getByPlaceholderText('mm')).toHaveValue(30);
  });

  it('saves the day expectation', async () => {
    upsert.mockResolvedValue(undefined);
    renderOverride();

    await userEvent.setup().click(button('Save'));

    await waitFor(() => expect(upsert).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('success');
    expect(toast.getByText('Expected hours updated')).toBeInTheDocument();
  });

  it('reports a refused save', async () => {
    upsert.mockRejectedValue(new Error('not allowed'));
    renderOverride();

    await userEvent.setup().click(button('Save'));

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(
      toast.getByText('Failed to update expected hours'),
    ).toBeInTheDocument();
  });

  it('clears an existing override', async () => {
    remove.mockResolvedValue(undefined);
    renderOverride(
      {
        id: 7,
        date: new Date('2026-07-26T00:00:00Z'),
        minutes: 240,
        label: null,
      },
      240,
    );

    await userEvent.setup().click(button('Clear'));

    await waitFor(() => expect(remove).toHaveBeenCalledWith(7));
    const toast = shownToast();
    expect(toast.type).toBe('success');
    expect(toast.getByText('Override cleared')).toBeInTheDocument();
  });

  it('reports a refused clear', async () => {
    remove.mockRejectedValue(new Error('already gone'));
    renderOverride(
      {
        id: 7,
        date: new Date('2026-07-26T00:00:00Z'),
        minutes: 240,
        label: null,
      },
      240,
    );

    await userEvent.setup().click(button('Clear'));

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(toast.getByText('Failed to clear override')).toBeInTheDocument();
  });
});
