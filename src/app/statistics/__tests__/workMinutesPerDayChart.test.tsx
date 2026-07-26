import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import type { TooltipItem } from 'chart.js/auto';

// Chart.js draws to a canvas jsdom does not implement, so the chart component is
// asserted through the data and options it hands the renderer. Those are the parts
// with logic in them: the days are sorted before plotting, minutes are converted to
// hours, and the tooltip formats the x value as a date.
jest.mock('react-chartjs-2', () => ({
  Line: (props: { data: unknown; options: unknown }) => (
    <div data-testid="line-chart" data-chart={JSON.stringify(props.data)} />
  ),
}));

let WorkMinutesPerDayChart: typeof import('../workMinutesPerDayChart').default;
let options: typeof import('../workMinutesPerDayChart').options;

beforeAll(async () => {
  const mod = await import('../workMinutesPerDayChart');
  WorkMinutesPerDayChart = mod.default;
  options = mod.options;
});

type ChartData = { labels: string[]; datasets: { data: number[] }[] };

const plotted = (): ChartData =>
  JSON.parse(
    screen.getByTestId('line-chart').getAttribute('data-chart') ?? '{}',
  ) as ChartData;

describe('WorkMinutesPerDayChart', () => {
  it('plots the days in order however the map was built', () => {
    render(
      <WorkMinutesPerDayChart
        workMinutesPerDay={
          new Map([
            ['2026-03-02', 480],
            ['2026-01-05', 450],
            ['2026-02-01', 300],
          ])
        }
      />,
    );

    expect(plotted().labels).toEqual([
      '2026-01-05',
      '2026-02-01',
      '2026-03-02',
    ]);
  });

  it('plots hours rather than the minutes it is given', () => {
    render(
      <WorkMinutesPerDayChart
        workMinutesPerDay={new Map([['2026-01-05', 450]])}
      />,
    );

    // 450 minutes is 7.5 hours; plotting raw minutes would put the axis out by 60x.
    expect(plotted().datasets[0].data).toEqual([7.5]);
  });

  it('renders an empty chart for a range with no work', () => {
    render(<WorkMinutesPerDayChart workMinutesPerDay={new Map()} />);

    expect(plotted().labels).toEqual([]);
  });
});

describe('chart options', () => {
  // Read inside the tests: the module is imported in beforeAll, which runs after the
  // describe body.
  const title = () => options.plugins.tooltip.callbacks.title;

  it('shows the hovered point as a date', () => {
    const point = [
      { parsed: { x: Date.parse('2026-01-05T00:00:00Z') } },
    ] as unknown as TooltipItem<'line'>[];

    expect(title()(point)).toBe('5.1.2026');
  });

  it('says nothing when the point carries no date', () => {
    const point = [{ parsed: { x: null } }] as unknown as TooltipItem<'line'>[];

    expect(title()(point)).toBe('');
  });
});
