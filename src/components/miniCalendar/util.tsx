import { calculateWorklogsSum } from '@/services';
import { AbsenceReason, SaldoForDay } from '@/types';
import { assertIsAbsenceReason } from '@/util/assertionFunctions';
import {
  add,
  daysInMonth,
  endOfMonth,
  startOfMonth,
  subtract,
} from '@/util/date';
import { toISODay, toWeekday } from '@/util/dateFormatter';
import { Worklog } from '@prisma/client';

export const CALENDAR_ITEM_CLASS =
  'w-10 sm:w-12 h-12 sm:h-14 sm:text-lg flex justify-center items-center rounded-full';
export const CALENDAR_ICON_CLASS = 'w-6 h-6 cursor-pointer';

const dailyDataForCalendar = (
  date: Date,
  status: string,
  worklogs: Worklog[],
): {
  date: Date;
  status: string;
  saldo: SaldoForDay;
  absence: AbsenceReason | undefined;
} => {
  const absence = worklogs.find((wl) => wl.absence)?.absence;
  if (absence) {
    assertIsAbsenceReason(absence);
  }
  return {
    date,
    status,
    saldo: calculateWorklogsSum(worklogs),
    absence: absence ?? undefined,
  };
};

export const daysForCalendarBuilder = (
  d: Date,
  worklogsByDay: Record<string, Worklog[] | undefined>,
) => {
  const startOfMonthDate = startOfMonth(d);
  const prevMonthDateAmount =
    toWeekday(startOfMonthDate) === 0 ? 6 : toWeekday(startOfMonthDate) - 1;
  const prevMonthDates = Array(prevMonthDateAmount)
    .fill(null)
    .map((_, i) => {
      const prevD = subtract(startOfMonthDate, prevMonthDateAmount - i, 'days');
      return dailyDataForCalendar(
        prevD,
        'prev',
        worklogsByDay[toISODay(prevD)] ?? [],
      );
    });

  const currentMonthDates = Array(daysInMonth(d))
    .fill(null)
    .map((_, i) => {
      const currentD = add(startOfMonthDate, i, 'days');
      return dailyDataForCalendar(
        currentD,
        'current',
        worklogsByDay[toISODay(currentD)] ?? [],
      );
    });

  const endOfMonthDate = endOfMonth(d);
  const nextMonthDateAmount =
    7 - ((prevMonthDates.length + currentMonthDates.length) % 7);
  const nextMonthDates =
    nextMonthDateAmount === 7
      ? []
      : Array(nextMonthDateAmount)
          .fill(null)
          .map((_, i) => {
            const nextD = add(endOfMonthDate, i + 1, 'days');
            return dailyDataForCalendar(
              nextD,
              'next',
              worklogsByDay[toISODay(nextD)] ?? [],
            );
          });

  return [...prevMonthDates, ...currentMonthDates, ...nextMonthDates];
};
