import { describe, expect, test } from '@jest/globals';
import { render, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import WorklogInputs from '../worklogInputs';
import { WorklogFormDataEntry } from '@/types';
import { Date_ISODay, Date_Time } from '@/util/dateFormatter';

const day = '2026-06-28' as Date_ISODay;
const time = (s: string) => s as Date_Time;

function Harness({
  initial,
  anchor,
}: {
  initial: WorklogFormDataEntry;
  anchor: Date_Time;
}) {
  const [value, setValue] = useState<WorklogFormDataEntry>(initial);
  const [valid, setValid] = useState(true);
  return (
    <>
      <WorklogInputs
        value={value}
        setValue={setValue}
        anchor={anchor}
        onValidityChange={setValid}
      />
      <div data-testid="from">{value.from}</div>
      <div data-testid="to">{value.to}</div>
      <div data-testid="lunch">{String(value.subtractLunchBreak)}</div>
      <div data-testid="valid">{String(valid)}</div>
    </>
  );
}

function renderInputs(
  overrides: Partial<WorklogFormDataEntry>,
  anchor: string,
) {
  const initial: WorklogFormDataEntry = {
    day,
    from: time('08:00'),
    to: time('16:00'),
    subtractLunchBreak: true,
    comment: '',
    ...overrides,
  };
  return render(<Harness initial={initial} anchor={time(anchor)} />);
}

const modeToggle = () =>
  screen.getByRole('checkbox', { name: 'Enter as duration' });
const toDuration = () => fireEvent.click(modeToggle());
const toTimes = () => fireEvent.click(modeToggle());

describe('WorklogInputs', () => {
  test('opens in Times mode showing From/To and the lunch toggle', () => {
    renderInputs({}, '08:00');
    expect(screen.getByPlaceholderText('From')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('To')).toBeInTheDocument();
    expect(
      screen.getByText('Subtract lunch break automatically'),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Hours')).not.toBeInTheDocument();
  });

  // @scenario worklog/Duration is net worked time, not span
  test('switching to Duration prefills net minutes and hides the lunch toggle', () => {
    renderInputs({}, '08:00');
    toDuration();
    // 08:00–16:00 minus 30min lunch = 7h 30min net
    expect(screen.getByPlaceholderText('Hours')).toHaveValue(7);
    expect(screen.getByPlaceholderText('Minutes')).toHaveValue(30);
    expect(
      screen.queryByText('Subtract lunch break automatically'),
    ).not.toBeInTheDocument();
  });

  // @scenario worklog/Duration is net worked time, not span
  test('duration is net time: lunch is folded in and the flag cleared', () => {
    renderInputs({}, '08:00');
    toDuration();
    // net 7h30 anchored at 08:00 -> 08:00–15:30, no lunch subtraction
    expect(screen.getByTestId('from')).toHaveTextContent('08:00');
    expect(screen.getByTestId('to')).toHaveTextContent('15:30');
    expect(screen.getByTestId('lunch')).toHaveTextContent('false');
    expect(screen.getByTestId('valid')).toHaveTextContent('true');
  });

  // @scenario worklog/Editing an existing entry in duration mode keeps its start
  test('editing an existing entry keeps its start time as the anchor', () => {
    renderInputs(
      { from: time('09:15'), to: time('16:45'), subtractLunchBreak: false },
      '09:15',
    );
    toDuration();
    fireEvent.change(screen.getByPlaceholderText('Hours'), {
      target: { value: '8' },
    });
    fireEvent.change(screen.getByPlaceholderText('Minutes'), {
      target: { value: '0' },
    });
    expect(screen.getByTestId('from')).toHaveTextContent('09:15');
    expect(screen.getByTestId('to')).toHaveTextContent('17:15');
  });

  test('rejects a duration that overflows past midnight', () => {
    renderInputs(
      { from: time('20:00'), to: time('21:00'), subtractLunchBreak: false },
      '20:00',
    );
    toDuration();
    fireEvent.change(screen.getByPlaceholderText('Hours'), {
      target: { value: '7' },
    });
    expect(
      screen.getByText('Duration is too long for a start of 20:00'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('valid')).toHaveTextContent('false');
    expect(screen.getByTestId('to')).toHaveTextContent('');
  });

  test('rejects a zero duration', () => {
    renderInputs(
      { from: time('08:00'), to: time('08:00'), subtractLunchBreak: false },
      '08:00',
    );
    toDuration();
    expect(
      screen.getByText('Duration must be greater than zero'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('valid')).toHaveTextContent('false');
  });

  test('switching back to Times stays valid when both ends are set', () => {
    renderInputs(
      { from: time('20:00'), to: time('21:00'), subtractLunchBreak: false },
      '20:00',
    );
    toDuration();
    toTimes();
    expect(screen.getByTestId('valid')).toHaveTextContent('true');
  });

  test('switching back to Times after an overflow error stays invalid (blank To)', () => {
    renderInputs(
      { from: time('20:00'), to: time('21:00'), subtractLunchBreak: false },
      '20:00',
    );
    toDuration();
    fireEvent.change(screen.getByPlaceholderText('Hours'), {
      target: { value: '7' },
    });
    expect(screen.getByTestId('valid')).toHaveTextContent('false');
    expect(screen.getByTestId('to')).toHaveTextContent('');
    // Back to Times: the blanked To must keep the submit gate closed.
    toTimes();
    expect(screen.getByTestId('valid')).toHaveTextContent('false');
    expect(screen.getByTestId('to')).toHaveTextContent('');
  });

  test('clearing the To field in Times mode reports invalid', () => {
    renderInputs({}, '08:00');
    fireEvent.change(screen.getByPlaceholderText('To'), {
      target: { value: '' },
    });
    expect(screen.getByTestId('valid')).toHaveTextContent('false');
  });

  test('negative hours input is clamped to 0 and does not crash', () => {
    renderInputs(
      { from: time('09:00'), to: time('17:00'), subtractLunchBreak: false },
      '09:00',
    );
    toDuration();
    fireEvent.change(screen.getByPlaceholderText('Hours'), {
      target: { value: '-5' },
    });
    // Clamped to 0; with minutes still 0 the duration is non-positive.
    expect(screen.getByPlaceholderText('Hours')).toHaveValue(0);
    expect(
      screen.getByText('Duration must be greater than zero'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('valid')).toHaveTextContent('false');
  });

  test('minutes input is clamped to a maximum of 59', () => {
    renderInputs(
      { from: time('08:00'), to: time('09:00'), subtractLunchBreak: false },
      '08:00',
    );
    toDuration();
    fireEvent.change(screen.getByPlaceholderText('Minutes'), {
      target: { value: '99' },
    });
    expect(screen.getByPlaceholderText('Minutes')).toHaveValue(59);
    // 08:00 + 1h59 = 09:59
    expect(screen.getByTestId('to')).toHaveTextContent('09:59');
  });
});
