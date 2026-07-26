import { describe, expect, test, jest } from '@jest/globals';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MiniCalendar from '../index';
import { useRouter } from 'next/navigation';
import { AbsenceReason, Worklog } from '@/types';

// Mock useRouter:
jest.mock('next/navigation');

const { result } = renderHook(() => {
  const router = useRouter();
  return { router };
});

const { router } = result.current;

describe('MiniCalendar', () => {
  test('should render the calendar', () => {
    const date = new Date('2023-01-01T00:00:00Z');
    const beginDate = date;
    const worklogs: Worklog[] = [];

    render(
      <MiniCalendar
        date={date}
        beginDate={beginDate}
        worklogs={worklogs}
        expectedMinutesPerDay={450}
        overrides={[]}
      />,
    );

    expect(screen.getByText('January 2023')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
  });

  test('should navigate to the previous month', async () => {
    const date = new Date('2023-01-01T00:00:00Z');
    const beginDate = date;
    const worklogs: Worklog[] = [];

    render(
      <MiniCalendar
        date={date}
        beginDate={beginDate}
        worklogs={worklogs}
        expectedMinutesPerDay={450}
        overrides={[]}
      />,
    );

    await userEvent.click(screen.getByText('Previous month'));

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(router.push).toHaveBeenCalledWith(`/?month=2022-12`);
  });

  test('should navigate to the next month', async () => {
    const date = new Date('2023-01-01T00:00:00Z');
    const beginDate = date;
    const worklogs: Worklog[] = [];

    render(
      <MiniCalendar
        date={date}
        beginDate={beginDate}
        worklogs={worklogs}
        expectedMinutesPerDay={450}
        overrides={[]}
      />,
    );

    await userEvent.click(screen.getByText('Next month'));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(router.push).toHaveBeenCalledWith(`/?month=2023-02`);
  });

  test('marks an absence day on which work was also logged', () => {
    const date = new Date('2023-01-01T00:00:00Z');
    const worklogs: Worklog[] = [
      {
        id: 1,
        from: new Date('2023-01-04T08:00:00Z'),
        to: new Date('2023-01-04T16:00:00Z'),
        subtractLunchBreak: true,
        absence: AbsenceReason.holiday,
        comment: null,
      },
      {
        id: 2,
        from: new Date('2023-01-04T17:00:00Z'),
        to: new Date('2023-01-04T20:00:00Z'),
        subtractLunchBreak: false,
        absence: null,
        comment: null,
      },
    ];

    render(
      <MiniCalendar
        date={date}
        beginDate={date}
        worklogs={worklogs}
        expectedMinutesPerDay={450}
        overrides={[]}
      />,
    );

    // The absence carries 450 synthetic minutes of its own; the label must
    // report only the 180 the user actually logged on top of it. react-icons
    // renders the label as an SVG <title> child, which getByTitle matches.
    expect(screen.getByTitle('Holiday, 3h logged')).toBeInTheDocument();
    expect(screen.queryByTitle('Holiday')).toBeNull();
    expect(screen.queryByText('10.5h')).toBeNull();
  });
});
