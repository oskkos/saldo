import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import type { Date_Time } from '@/util/dateFormatter';
import type { Settings as SettingsType } from '@/types';

// Settings decides the whole balance, so its validation is the interesting part: it
// refuses to save without a begin date or default times, and refuses times in the
// wrong order. Each of those raises before the action is reached, and each surfaces
// as a toast — none of which the browser suite can produce, because the form always
// has valid values in it there.
jest.mock('@/actions', () => ({ onSettingsUpdate: jest.fn() }));

type UpdateMock = jest.Mock<(data: unknown) => Promise<unknown>>;

let Settings: typeof import('../settings').default;
let ToastContext: typeof import('@/components/toastContext').ToastContext;
let update: UpdateMock;

beforeAll(async () => {
  Settings = (await import('../settings')).default;
  ToastContext = (await import('@/components/toastContext')).ToastContext;
  update = (await import('@/actions'))
    .onSettingsUpdate as unknown as UpdateMock;
});

const time = (s: string) => s as Date_Time;
const setMsg = jest.fn<(msg: unknown) => void>();

const settings = (overrides: Partial<SettingsType> = {}): SettingsType => ({
  id: 1,
  beginDate: new Date('2026-01-05T00:00:00Z'),
  initialBalanceHours: 2,
  initialBalanceMins: 30,
  fromDefault: time('08:00'),
  toDefault: time('16:00'),
  expectedMinutesPerDay: 450,
  ...overrides,
});

const shownToast = () => {
  const [msg] = setMsg.mock.calls[0] as [{ type: string; message: ReactNode }];
  return { type: msg.type, ...render(<>{msg.message}</>) };
};

const renderSettings = (overrides: Partial<SettingsType> = {}) =>
  render(
    <ToastContext.Provider value={{ msg: null, setMsg }}>
      <Settings settings={settings(overrides)} />
    </ToastContext.Provider>,
  );

const submit = () =>
  userEvent.setup().click(screen.getByRole('button', { name: 'Submit' }));

// Initial balance and expected-per-day both render an hh/mm pair, so the fields are
// addressed by position: the first pair is the balance, the second the daily figure.
const hours = (which: 0 | 1) => screen.getAllByPlaceholderText('hh')[which];
const minutes = (which: 0 | 1) => screen.getAllByPlaceholderText('mm')[which];
const beginDate = () => screen.getByDisplayValue('2026-01-05');

beforeEach(() => {
  update.mockReset();
  setMsg.mockReset();
});

describe('Settings', () => {
  it('opens on the values already saved, with expected minutes split into hours', () => {
    renderSettings();

    expect(hours(0)).toHaveValue(2);
    expect(minutes(0)).toHaveValue(30);
    expect(screen.getByDisplayValue('08:00')).toBeInTheDocument();
    // 450 minutes is 7:30.
    expect(hours(1)).toHaveValue(7);
    expect(minutes(1)).toHaveValue(30);
  });

  it('saves the values as entered', async () => {
    update.mockResolvedValue(undefined);
    renderSettings();

    await submit();

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          initialBalanceHours: 2,
          initialBalanceMins: 30,
          fromDefault: '08:00',
          toDefault: '16:00',
          expectedMinutesPerDay: 450,
        }),
      ),
    );
    expect(shownToast().type).toBe('success');
    expect(screen.getByText('Settings saved')).toBeInTheDocument();
  });

  it('refuses times in the wrong order', async () => {
    renderSettings({ fromDefault: time('17:00'), toDefault: time('09:00') });

    await submit();

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    expect(update).not.toHaveBeenCalled();
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(
      screen.getByText('From time must be before to time'),
    ).toBeInTheDocument();
  });

  it('refuses to save without a begin date', async () => {
    renderSettings();
    // user.clear() does not fire a change on a date input in jsdom, so the empty
    // value is set directly — the same event the browser sends.
    fireEvent.change(beginDate(), { target: { value: '' } });

    await submit();

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    expect(update).not.toHaveBeenCalled();
    shownToast();
    expect(screen.getByText('Begin date is required')).toBeInTheDocument();
  });

  it('treats cleared numbers as zero rather than refusing', async () => {
    update.mockResolvedValue(undefined);
    renderSettings();
    const user = userEvent.setup();
    await user.clear(hours(0));
    await user.clear(minutes(0));

    await submit();

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          initialBalanceHours: 0,
          initialBalanceMins: 0,
        }),
      ),
    );
  });

  it('reports a failure from the server', async () => {
    update.mockRejectedValue(new Error('database unavailable'));
    renderSettings();

    await submit();

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(screen.getByText('Failed to save settings')).toBeInTheDocument();
    expect(screen.getByText('database unavailable')).toBeInTheDocument();
  });

  it('omits a detail line when the failure carries no message', async () => {
    update.mockRejectedValue('a bare string');
    renderSettings();

    await submit();

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    shownToast();
    expect(screen.getByText('Failed to save settings')).toBeInTheDocument();
  });
});
