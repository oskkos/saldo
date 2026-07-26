import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AbsenceReason, type AbsenceData } from '@/types';
import type { ReactNode } from 'react';

// The absence form is a client component whose only write path is the
// onAbsenceSubmit server action. It sends the range as one submission — the
// expansion into one record per day, and the times each record is stored with,
// belong to the server (see actions/__tests__/absenceActions.test.ts). The mock
// factory is not hoisted (this file imports `jest` from @jest/globals), hence
// the dynamic import in beforeAll.
jest.mock('@/actions', () => ({ onAbsenceSubmit: jest.fn() }));

type SubmitMock = jest.Mock<(data: AbsenceData) => Promise<unknown>>;

let Absence: typeof import('../absence').default;
let ToastContext: typeof import('@/components/toastContext').ToastContext;
let submit: SubmitMock;
let container: HTMLElement;

const setMsg = jest.fn<(msg: unknown) => void>();

beforeAll(async () => {
  Absence = (await import('../absence')).default;
  ToastContext = (await import('@/components/toastContext')).ToastContext;
  submit = (await import('@/actions')).onAbsenceSubmit as unknown as SubmitMock;
});

// The toast itself is rendered by the layout's provider, so the message is
// asserted where the form hands it over.
const renderForm = () => {
  container = render(
    <ToastContext.Provider value={{ msg: null, setMsg }}>
      <Absence />
    </ToastContext.Provider>,
  ).container;
};

// The From/To labels are sibling badges rather than <label for>, so the two
// date inputs are addressed positionally.
const dateInput = (which: 'from' | 'to') =>
  container.querySelectorAll<HTMLInputElement>('input[type="date"]')[
    which === 'from' ? 0 : 1
  ];

const setDate = (which: 'from' | 'to', value: string) =>
  fireEvent.change(dateInput(which), { target: { value } });

const pickReason = (reason: AbsenceReason) =>
  fireEvent.change(screen.getByRole('combobox'), { target: { value: reason } });

const dayOf = (date: Date | null) => date?.toISOString().slice(0, 10);

beforeEach(() => {
  jest.clearAllMocks();
  submit.mockResolvedValue([{ id: 1 }]);
});

describe('Absence form', () => {
  // @scenario absence/Reason selection
  it('offers exactly the four recognized reasons', () => {
    renderForm();

    const options = screen
      .getAllByRole('option')
      .map((o) => (o as HTMLOptionElement).value)
      .filter(Boolean);

    expect(options).toEqual([
      AbsenceReason.holiday,
      AbsenceReason.flex_hours,
      AbsenceReason.sick_leave,
      AbsenceReason.other,
    ]);
  });

  // @scenario absence/Holiday means annual leave
  it('records a holiday as leave the user took on the chosen day', async () => {
    renderForm();
    setDate('from', '2026-06-29');
    setDate('to', '2026-06-29');
    pickReason(AbsenceReason.holiday);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const [entry] = submit.mock.calls[0];
    // A holiday absence is an ordinary worklog carrying the reason: a day the
    // user took off. It is unrelated to the public-holiday calendar, which
    // already removes days from the expected-hours accrual.
    expect(entry.reason).toBe(AbsenceReason.holiday);
    expect(dayOf(entry.from)).toBe('2026-06-29');
    expect(dayOf(entry.to)).toBe('2026-06-29');
  });

  it('submits the whole range in a single call', async () => {
    renderForm();
    setDate('from', '2026-06-29');
    setDate('to', '2026-07-01');
    pickReason(AbsenceReason.sick_leave);
    fireEvent.change(screen.getByPlaceholderText('Comment'), {
      target: { value: 'Flu' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    // One submission, not one per day: the days are checked together so a
    // conflict on any of them can reject all of them.
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const [entry] = submit.mock.calls[0];
    expect(dayOf(entry.from)).toBe('2026-06-29');
    expect(dayOf(entry.to)).toBe('2026-07-01');
    expect(entry.reason).toBe(AbsenceReason.sick_leave);
    expect(entry.comment).toBe('Flu');
  });

  it('reports a rejected submission with the reason it was rejected for', async () => {
    submit.mockRejectedValue(
      new Error('An absence is already recorded for 30.6.2026.'),
    );
    renderForm();
    setDate('from', '2026-06-29');
    setDate('to', '2026-07-01');
    pickReason(AbsenceReason.holiday);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const msg = setMsg.mock.calls[0][0] as {
      type?: string;
      message: ReactNode;
    };
    expect(msg.type).toBe('error');
    // The rejection's own words reach the user, not just a generic failure:
    // that is what names the day the range collided on.
    const { getByText } = render(<>{msg.message}</>);
    expect(getByText('Failed to add absence')).toBeInTheDocument();
    expect(
      getByText('An absence is already recorded for 30.6.2026.'),
    ).toBeInTheDocument();
  });

  // @scenario absence/Range normalization
  it('pushes the to-date out when a later from-date is chosen', () => {
    renderForm();
    setDate('from', '2026-06-29');
    setDate('to', '2026-06-30');

    setDate('from', '2026-07-05');

    // The from-date may not end up after the to-date.
    expect(dateInput('to')).toHaveValue('2026-07-05');
  });

  // @scenario absence/Range normalization
  it('pulls the from-date back when an earlier to-date is chosen', () => {
    renderForm();
    setDate('from', '2026-06-29');

    setDate('to', '2026-06-20');

    expect(dateInput('from')).toHaveValue('2026-06-20');
  });
});
