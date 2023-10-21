import { describe, expect, test, jest } from '@jest/globals';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MiniCalendar from '../index';
import { Worklog } from '@prisma/client';
import { useRouter } from 'next/navigation';

// Mock useRouter:
jest.mock('next/navigation');

const { result } = renderHook(() => {
  const router = useRouter();
  return { router };
});

const { router } = result.current;

describe('MiniCalendar', () => {
  test('should render the calendar', () => {
    const date = new Date(2023, 0, 1);
    const beginDate = date;
    const worklogs: Worklog[] = [];

    render(
      <MiniCalendar date={date} beginDate={beginDate} worklogs={worklogs} />,
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
    const date = new Date(2023, 0, 1);
    const beginDate = date;
    const worklogs: Worklog[] = [];

    render(
      <MiniCalendar date={date} beginDate={beginDate} worklogs={worklogs} />,
    );

    await userEvent.click(screen.getByText('Previous month'));

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(router.push).toHaveBeenCalledWith(`/?month=2022-12`);
  });

  test('should navigate to the next month', async () => {
    const date = new Date(2023, 0, 1);
    const beginDate = date;
    const worklogs: Worklog[] = [];

    render(
      <MiniCalendar date={date} beginDate={beginDate} worklogs={worklogs} />,
    );

    await userEvent.click(screen.getByText('Next month'));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(router.push).toHaveBeenCalledWith(`/?month=2023-02`);
  });
});
