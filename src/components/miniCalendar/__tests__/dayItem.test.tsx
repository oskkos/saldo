import { describe, expect, test } from '@jest/globals';
import { render, within } from '@testing-library/react';
import DayItem from '../dayItem';
import { AbsenceReason } from '@/types';

// A past working day (Monday 2023-10-16) so the in-future branch never applies.
const workingDay = new Date('2023-10-16T00:00:00.000Z');
const weekend = new Date('2023-10-14T00:00:00.000Z');
const beginDate = new Date('2023-10-01T00:00:00.000Z');

const saldo = (minutes: number) => ({
  hours: Math.floor(minutes / 60),
  minutes: minutes % 60,
  toString: () => `${Math.floor(minutes / 60)}h ${minutes % 60}min`,
});

function borderClassOf(container: HTMLElement) {
  return container.querySelector('a')?.className ?? '';
}

describe('DayItem coloring', () => {
  test('green + dashed when a short-day override is worked in full', () => {
    const { container } = render(
      <DayItem
        date={workingDay}
        status="current"
        saldo={saldo(300)}
        workedMinutes={300}
        beginDate={beginDate}
        expectedMinutes={300}
        hasOverride={true}
      />,
    );
    const cls = borderClassOf(container);
    expect(cls).toContain('border-success');
    expect(cls).toContain('border-dashed');
  });

  test('warning when worked less than the resolved expected', () => {
    const { container } = render(
      <DayItem
        date={workingDay}
        status="current"
        saldo={saldo(200)}
        workedMinutes={200}
        beginDate={beginDate}
        expectedMinutes={300}
        hasOverride={true}
      />,
    );
    expect(borderClassOf(container)).toContain('border-warning');
  });

  test('solid border on a normal day (no override)', () => {
    const { container } = render(
      <DayItem
        date={workingDay}
        status="current"
        saldo={saldo(450)}
        workedMinutes={450}
        beginDate={beginDate}
        expectedMinutes={450}
        hasOverride={false}
      />,
    );
    const cls = borderClassOf(container);
    expect(cls).toContain('border-success');
    expect(cls).toContain('border-solid');
  });

  test('info border on a non-working day worked (expected 0)', () => {
    const { container } = render(
      <DayItem
        date={weekend}
        status="current"
        saldo={saldo(120)}
        workedMinutes={120}
        beginDate={beginDate}
        expectedMinutes={0}
        hasOverride={false}
      />,
    );
    expect(borderClassOf(container)).toContain('border-info');
  });
});

describe('DayItem sub-line', () => {
  const cell = (props: {
    saldoMinutes: number;
    workedMinutes: number;
    absence?: AbsenceReason;
  }) =>
    render(
      <DayItem
        date={workingDay}
        status="current"
        saldo={saldo(props.saldoMinutes)}
        workedMinutes={props.workedMinutes}
        absence={props.absence}
        beginDate={beginDate}
        expectedMinutes={450}
        hasOverride={false}
      />,
    );

  // @scenario absence/Hours worked on an absence day stay visible
  test('shows the icon and the hours worked on top of an absence', () => {
    // A holiday (450 synthetic minutes) plus a 3-hour worklog: the total the
    // border uses is 630, but the figure shown must be the 180 actually worked.
    const { container } = cell({
      saldoMinutes: 630,
      workedMinutes: 180,
      absence: AbsenceReason.holiday,
    });

    expect(within(container).getByText('3h')).toBeInTheDocument();
    expect(container.querySelector('svg > title')?.textContent).toBe('Holiday');
  });

  // @scenario absence/An absence-only day shows no hours
  test('shows the icon alone when nothing was worked on the absence day', () => {
    const { container } = cell({
      saldoMinutes: 450,
      workedMinutes: 0,
      absence: AbsenceReason.holiday,
    });

    expect(container.querySelector('svg > title')?.textContent).toBe('Holiday');
    expect(container.textContent).not.toMatch(/\d+(\.\d+)?h/);
  });

  test('shows the hours on an ordinary day, as before', () => {
    const { container } = cell({ saldoMinutes: 450, workedMinutes: 450 });

    expect(within(container).getByText('7.5h')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });
});
