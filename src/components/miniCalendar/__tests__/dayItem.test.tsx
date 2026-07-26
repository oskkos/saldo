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

  // @scenario absence/Work on an absence day marks the icon
  test('tints the icon and names the hours when work was done on the absence', () => {
    // A holiday (450 synthetic minutes) plus a 3-hour worklog: the total the
    // border uses is 630, but what the icon reports is the 180 actually worked.
    const { container } = cell({
      saldoMinutes: 630,
      workedMinutes: 180,
      absence: AbsenceReason.holiday,
    });

    const icon = container.querySelector('svg');
    expect(icon).toHaveClass('text-success');
    expect(icon?.querySelector('title')?.textContent).toBe(
      'Holiday, 3h logged',
    );
    // No second figure competes with the icon for the sub-line; the hours
    // appear in the icon's label, not as text of their own.
    expect(within(container).queryByText('3h')).toBeNull();
  });

  // @scenario absence/An absence-only day shows a plain icon
  test('leaves the icon plain when nothing was worked on the absence day', () => {
    const { container } = cell({
      saldoMinutes: 450,
      workedMinutes: 0,
      absence: AbsenceReason.holiday,
    });

    const icon = container.querySelector('svg');
    expect(icon).not.toHaveClass('text-success');
    expect(icon?.querySelector('title')?.textContent).toBe('Holiday');
    expect(within(container).queryByText(/\dh/)).toBeNull();
  });

  test('shows the hours on an ordinary day, as before', () => {
    const { container } = cell({ saldoMinutes: 450, workedMinutes: 450 });

    expect(within(container).getByText('7.5h')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });
});
