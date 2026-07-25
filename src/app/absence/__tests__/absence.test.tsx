import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AbsenceReason, type WorklogFormData } from '@/types';

// The absence form is a client component whose only write path is the
// onWorklogSubmit server action, so mocking that action is what lets the
// multi-day fan-out be asserted. The mock factory is not hoisted (this file
// imports `jest` from @jest/globals), hence the dynamic import in beforeAll.
jest.mock('@/actions', () => ({ onWorklogSubmit: jest.fn() }));

type SubmitMock = jest.Mock<(data: WorklogFormData) => Promise<unknown>>;

let Absence: typeof import('../absence').default;
let submit: SubmitMock;
let container: HTMLElement;

beforeAll(async () => {
  Absence = (await import('../absence')).default;
  submit = (await import('@/actions')).onWorklogSubmit as unknown as SubmitMock;
});

const renderForm = () => {
  container = render(<Absence />).container;
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

const dayOf = (entry: WorklogFormData) => entry.from.toISOString().slice(0, 10);

beforeEach(() => {
  jest.clearAllMocks();
  submit.mockResolvedValue({ id: 1 });
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
    expect(entry.absence).toBe(AbsenceReason.holiday);
    expect(dayOf(entry)).toBe('2026-06-29');
  });

  // @scenario absence/Three-day absence
  it('creates one record per day across the range, all alike', async () => {
    renderForm();
    setDate('from', '2026-06-29');
    setDate('to', '2026-07-01');
    pickReason(AbsenceReason.sick_leave);
    fireEvent.change(screen.getByPlaceholderText('Comment'), {
      target: { value: 'Flu' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(3));
    const entries = submit.mock.calls.map(([entry]) => entry);
    expect(entries.map(dayOf)).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
    ]);
    for (const entry of entries) {
      expect(entry.absence).toBe(AbsenceReason.sick_leave);
      expect(entry.comment).toBe('Flu');
    }
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
