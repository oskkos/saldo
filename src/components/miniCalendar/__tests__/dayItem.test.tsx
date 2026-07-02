import { describe, expect, test } from '@jest/globals';
import { render } from '@testing-library/react';
import DayItem from '../dayItem';

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
        beginDate={beginDate}
        expectedMinutes={0}
        hasOverride={false}
      />,
    );
    expect(borderClassOf(container)).toContain('border-info');
  });
});
