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

import type { ExpectedHoursOverride } from '@/types';

// Special days override the expected hours for one date, so the list has to stay
// correct after every change: a save replaces the entry for that date rather than
// adding a second one, and a removal takes only its own row. Both are done optimistically
// in local state, which is where a wrong filter would show up — and where the browser
// suite cannot see it, because it reloads the page afterwards.
jest.mock('@/actions', () => ({
  onExpectedHoursOverrideUpsert: jest.fn(),
  onExpectedHoursOverrideDelete: jest.fn(),
}));

type UpsertMock = jest.Mock<(data: unknown) => Promise<ExpectedHoursOverride>>;
type DeleteMock = jest.Mock<(id: number) => Promise<unknown>>;

let ExpectedHoursOverrides: typeof import('../expectedHoursOverrides').default;
let ToastContext: typeof import('@/components/toastContext').ToastContext;
let upsert: UpsertMock;
let remove: DeleteMock;

beforeAll(async () => {
  ExpectedHoursOverrides = (await import('../expectedHoursOverrides')).default;
  ToastContext = (await import('@/components/toastContext')).ToastContext;
  const actions = await import('@/actions');
  upsert = actions.onExpectedHoursOverrideUpsert as unknown as UpsertMock;
  remove = actions.onExpectedHoursOverrideDelete as unknown as DeleteMock;
});

const setMsg = jest.fn<(msg: unknown) => void>();

const override = (
  id: number,
  date: string,
  minutes: number,
  label: string | null = null,
): ExpectedHoursOverride => ({ id, date: new Date(date), minutes, label });

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

const renderOverrides = (overrides: ExpectedHoursOverride[] = []) =>
  render(
    <ToastContext.Provider value={{ msg: null, setMsg }}>
      <ExpectedHoursOverrides overrides={overrides} />
    </ToastContext.Provider>,
  );

const dateField = () => screen.getByPlaceholderText('Date');
const saveButton = () =>
  screen.getByRole('button', { name: 'Add special day' });

beforeEach(() => {
  upsert.mockReset();
  remove.mockReset();
  setMsg.mockReset();
});

describe('ExpectedHoursOverrides', () => {
  it('says so when there are none', () => {
    renderOverrides();

    expect(screen.getByText('No special days yet.')).toBeInTheDocument();
  });

  it('lists them oldest first, whatever order they arrive in', () => {
    renderOverrides([
      override(2, '2026-03-10T00:00:00Z', 240),
      override(1, '2026-01-06T00:00:00Z', 450, 'Short Friday'),
    ]);

    const rows = screen.getAllByRole('button', { name: /—/ });
    expect(rows[0]).toHaveTextContent('6.1.2026');
    expect(rows[1]).toHaveTextContent('10.3.2026');
    // The label is shown alongside the figure when there is one.
    expect(rows[0]).toHaveTextContent('Short Friday');
  });

  it('cannot save until a date is chosen', () => {
    renderOverrides();

    expect(saveButton()).toBeDisabled();
  });

  it('saves a new special day and clears the form', async () => {
    const saved = override(3, '2026-05-01T00:00:00Z', 270, 'May Day');
    upsert.mockResolvedValue(saved);
    renderOverrides();

    fireEvent.change(dateField(), { target: { value: '2026-05-01' } });
    await userEvent.setup().click(saveButton());

    await waitFor(() => expect(upsert).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('success');
    expect(toast.getByText('Special day saved')).toBeInTheDocument();
    // The form resets, so the next entry does not inherit this date.
    await waitFor(() => expect(dateField()).toHaveValue(''));
  });

  it('replaces the entry for a date rather than listing it twice', async () => {
    const existing = override(1, '2026-01-06T00:00:00Z', 450);
    upsert.mockResolvedValue(override(1, '2026-01-06T00:00:00Z', 240));
    renderOverrides([existing]);

    fireEvent.change(dateField(), { target: { value: '2026-01-06' } });
    await userEvent.setup().click(saveButton());

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /—/ })).toHaveLength(1),
    );
  });

  it('reports a refused save', async () => {
    upsert.mockRejectedValue(new Error('date is in the past'));
    renderOverrides();

    fireEvent.change(dateField(), { target: { value: '2026-05-01' } });
    await userEvent.setup().click(saveButton());

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(toast.getByText('Failed to save special day')).toBeInTheDocument();
    expect(toast.getByText('date is in the past')).toBeInTheDocument();
  });

  it('removes only the row asked for', async () => {
    remove.mockResolvedValue(undefined);
    renderOverrides([
      override(1, '2026-01-06T00:00:00Z', 450),
      override(2, '2026-03-10T00:00:00Z', 240),
    ]);

    await userEvent.setup().click(screen.getAllByTitle('Remove')[0]);

    await waitFor(() => expect(remove).toHaveBeenCalledWith(1));
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /—/ })).toHaveLength(1),
    );
    expect(
      screen.getByRole('button', { name: /10\.3\.2026/ }),
    ).toBeInTheDocument();
  });

  it('reports a refused removal', async () => {
    remove.mockRejectedValue(new Error('not yours'));
    renderOverrides([override(1, '2026-01-06T00:00:00Z', 450)]);

    await userEvent.setup().click(screen.getByTitle('Remove'));

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(toast.getByText('Failed to remove special day')).toBeInTheDocument();
  });

  it('loads an existing day back into the form when it is clicked', async () => {
    renderOverrides([override(1, '2026-01-06T00:00:00Z', 450, 'Short Friday')]);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /6\.1\.2026/ }));

    expect(dateField()).toHaveValue('2026-01-06');
    // 450 minutes split back into 7:30, and the label restored for editing.
    expect(screen.getByPlaceholderText('hh')).toHaveValue(7);
    expect(screen.getByPlaceholderText('mm')).toHaveValue(30);
    expect(screen.getByDisplayValue('Short Friday')).toBeInTheDocument();
  });
});
