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

// The clock is the app's most-used control and it has two entirely different faces:
// an idle button, and a running card with the elapsed time. The failure branch — the
// toast shown when clocking in is refused — is what the browser suite cannot reach,
// and without it a user would believe they were on the clock when they were not.
//
// The finalize sheet is stubbed; it has its own test. showModal is mocked because
// jsdom implements no dialog.
jest.mock('@/actions', () => ({ onClockIn: jest.fn() }));
jest.mock('@/util/date', () => ({ now: jest.fn() }));
jest.mock('../../modal', () => ({ showModal: jest.fn() }));
jest.mock('../clockOutModal', () => ({
  __esModule: true,
  default: ({ onDone }: { onDone: () => void }) => (
    <button onClick={onDone}>stub-finalize</button>
  ),
}));

type ClockInMock = jest.Mock<(start: Date) => Promise<{ startedAt: Date }>>;
type NowMock = jest.Mock<() => Date>;
type ShowModalMock = jest.Mock<(id: string) => void>;

let ClockCard: typeof import('../clockCard').default;
let ToastContext: typeof import('../../toastContext').ToastContext;
let clockIn: ClockInMock;
let now: NowMock;
let showModal: ShowModalMock;

beforeAll(async () => {
  ClockCard = (await import('../clockCard')).default;
  ToastContext = (await import('../../toastContext')).ToastContext;
  clockIn = (await import('@/actions')).onClockIn as unknown as ClockInMock;
  now = (await import('@/util/date')).now as unknown as NowMock;
  showModal = (await import('../../modal'))
    .showModal as unknown as ShowModalMock;
});

const startedAt = new Date('2026-07-26T08:00:00Z');
const setMsg = jest.fn<(msg: unknown) => void>();

const shownToast = () => {
  const [msg] = setMsg.mock.calls[0] as [{ type: string; message: ReactNode }];
  return msg;
};

const renderCard = (activeSession: { startedAt: Date } | null) =>
  render(
    <ToastContext.Provider value={{ msg: null, setMsg }}>
      <ClockCard activeSession={activeSession} />
    </ToastContext.Provider>,
  );

beforeEach(() => {
  clockIn.mockReset();
  now.mockReset();
  showModal.mockReset();
  setMsg.mockReset();
  now.mockReturnValue(new Date('2026-07-26T09:00:00Z'));
});

describe('ClockCard when idle', () => {
  beforeEach(() => {
    renderCard(null);
  });

  it('offers to start the clock', () => {
    expect(
      screen.getByRole('button', { name: /clock in/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clock out/i })).toBeNull();
  });

  it('starts the clock and switches to the running card', async () => {
    clockIn.mockResolvedValue({ startedAt });

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /clock in/i }));

    await waitFor(() => expect(clockIn).toHaveBeenCalled());
    expect(shownToast().type).toBe('success');
    expect(
      await screen.findByRole('button', { name: /clock out/i }),
    ).toBeInTheDocument();
  });

  it('says so when starting the clock is refused', async () => {
    clockIn.mockRejectedValue(new Error('already clocked in'));

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /clock in/i }));

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    expect(shownToast().type).toBe('error');
    // Still idle: nothing should suggest a session is running.
    expect(screen.queryByRole('button', { name: /clock out/i })).toBeNull();
  });
});

describe('ClockCard while running', () => {
  beforeEach(() => {
    renderCard({ startedAt });
  });

  it('shows when the session began', () => {
    expect(screen.getByText(/Since 08:00/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clock in/i })).toBeNull();
  });

  it('opens the finalize sheet when the clock is stopped', async () => {
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /clock out/i }));

    await waitFor(() =>
      expect(showModal).toHaveBeenCalledWith('clock-out-modal'),
    );
    expect(
      screen.getByRole('button', { name: 'stub-finalize' }),
    ).toBeInTheDocument();
  });

  it('returns to idle once the session is finalised', async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /clock out/i }));
    await user.click(screen.getByRole('button', { name: 'stub-finalize' }));

    expect(
      await screen.findByRole('button', { name: /clock in/i }),
    ).toBeInTheDocument();
  });
});
