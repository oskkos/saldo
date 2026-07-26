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

// The sheet that turns a finished session into a worklog. Three things here are
// reachable nowhere else:
//
//  - the midnight-crossing case, where the end time is deliberately blanked and Save
//    held disabled rather than prefilled with a plausible-but-wrong value;
//  - discard, which asks for confirmation first and must do nothing if refused;
//  - both failure toasts.
jest.mock('@/actions', () => ({
  onClockOut: jest.fn(),
  onClockDiscard: jest.fn(),
}));

type ActionMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

let ClockOutModal: typeof import('../clockOutModal').default;
let ToastContext: typeof import('../../toastContext').ToastContext;
let clockOut: ActionMock;
let discard: ActionMock;

beforeAll(async () => {
  ClockOutModal = (await import('../clockOutModal')).default;
  ToastContext = (await import('../../toastContext')).ToastContext;
  const actions = await import('@/actions');
  clockOut = actions.onClockOut as unknown as ActionMock;
  discard = actions.onClockDiscard as unknown as ActionMock;
});

const onDone = jest.fn();
const setMsg = jest.fn<(msg: unknown) => void>();

const shownToast = () => {
  const [msg] = setMsg.mock.calls[0] as [{ type: string; message: ReactNode }];
  return { type: msg.type, ...render(<>{msg.message}</>) };
};

const renderModal = ({
  startedAt = new Date('2026-07-26T08:00:00Z'),
  endedAt = new Date('2026-07-26T16:00:00Z'),
} = {}) =>
  render(
    <ToastContext.Provider value={{ msg: null, setMsg }}>
      <ClockOutModal
        modalId="clock-out"
        startedAt={startedAt}
        endedAt={endedAt}
        onDone={onDone}
      />
    </ToastContext.Provider>,
  );

const button = (name: string) =>
  screen.getByRole('button', { name, hidden: true });

beforeEach(() => {
  clockOut.mockReset();
  discard.mockReset();
  onDone.mockReset();
  setMsg.mockReset();
});

describe('ClockOutModal', () => {
  it('prefills the times the session actually ran', () => {
    renderModal();

    expect(screen.getByDisplayValue('08:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('16:00')).toBeInTheDocument();
    expect(button('Save')).toBeEnabled();
  });

  it('saves the session as a worklog', async () => {
    clockOut.mockResolvedValue(undefined);
    renderModal();

    await userEvent.setup().click(button('Save'));

    await waitFor(() => expect(clockOut).toHaveBeenCalled());
    expect(shownToast().type).toBe('success');
    expect(screen.getByText('Worklog created')).toBeInTheDocument();
  });

  it('reports the reason when saving is refused', async () => {
    clockOut.mockRejectedValue(new Error('overlaps an existing worklog'));
    renderModal();

    await userEvent.setup().click(button('Save'));

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(screen.getByText('Failed to save session')).toBeInTheDocument();
    expect(
      screen.getByText('overlaps an existing worklog'),
    ).toBeInTheDocument();
  });
});

describe('ClockOutModal when the session crossed midnight', () => {
  const overnight = {
    startedAt: new Date('2026-07-26T22:00:00Z'),
    endedAt: new Date('2026-07-27T06:00:00Z'),
  };

  it('warns, blanks the end time and refuses to save', () => {
    renderModal(overnight);

    // Queried by text, not by role: the warning is a daisyUI `alert` class with no
    // role="alert", so assistive technology is not told about it either.
    expect(screen.getByText(/crossed midnight/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('22:00')).toBeInTheDocument();
    // No plausible-but-wrong end time is offered, and Save stays out of reach.
    expect(button('Save')).toBeDisabled();
  });
});

describe('ClockOutModal discard', () => {
  const confirmSpy = jest.spyOn(window, 'confirm');

  beforeEach(() => {
    confirmSpy.mockReset();
  });

  it('does nothing if the confirmation is refused', async () => {
    confirmSpy.mockReturnValue(false);
    renderModal();

    await userEvent.setup().click(button('Discard'));

    expect(discard).not.toHaveBeenCalled();
    expect(setMsg).not.toHaveBeenCalled();
  });

  it('discards the session once confirmed', async () => {
    confirmSpy.mockReturnValue(true);
    discard.mockResolvedValue(undefined);
    renderModal();

    await userEvent.setup().click(button('Discard'));

    await waitFor(() => expect(discard).toHaveBeenCalled());
    expect(shownToast().type).toBe('success');
    expect(screen.getByText('Session discarded')).toBeInTheDocument();
  });

  it('says so when discarding fails', async () => {
    confirmSpy.mockReturnValue(true);
    discard.mockRejectedValue(new Error('no active session'));
    renderModal();

    await userEvent.setup().click(button('Discard'));

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(screen.getByText('Failed to discard session')).toBeInTheDocument();
  });
});
