import { AbsenceReason } from '@/types';
import { isHoliday, isWeekend, now, sameDay, startOfDay } from '@/util/date';
import { toDay, toISODay } from '@/util/dateFormatter';
import Link from 'next/link';
import CalendarCell from './calendarCell';
import { CALENDAR_ITEM_CLASS } from './util';

const calendarDayItemClass = `${CALENDAR_ITEM_CLASS} cursor-pointer`;

export default function DayItem({
  date,
  status,
  saldo,
  workedMinutes,
  absence,
  beginDate,
  expectedMinutes,
  hasOverride,
}: {
  date: Date;
  status: string;
  saldo: { hours: number; minutes: number; toString: () => string };
  workedMinutes: number;
  absence?: AbsenceReason;
  beginDate: Date;
  expectedMinutes: number;
  hasOverride: boolean;
}) {
  const minutes = saldo.hours * 60 + saldo.minutes;
  // The cell reports hours actually logged. On an absence day the total above
  // includes the absence's own stored times, which would read as work nobody
  // did; on every other day the two are the same number.
  const hoursCompact = Math.round((workedMinutes * 10) / 60) / 10;
  // Solid border on normal days; dashed marks a day with a custom expected value.
  // Color answers "did I meet this day's expected"; style answers "is it special".
  const style = hasOverride ? 'border-dashed' : 'border-solid';
  const borderClass = () => {
    if (status !== 'current') {
      return '';
    }
    const beforeBegin = startOfDay(date) < startOfDay(beginDate);
    const inFuture = startOfDay(date) > startOfDay();
    if (beforeBegin || inFuture) {
      return minutes !== 0 ? `border-2 ${style} border-base-300` : '';
    }
    // Resolved expected of 0 = non-working day (weekend/holiday, no override).
    if (expectedMinutes === 0) {
      return minutes ? `border-2 ${style} border-info` : '';
    }
    if (minutes === 0) {
      return `border-2 ${style} border-error`;
    }
    if (minutes < expectedMinutes) {
      return `border-2 ${style} border-warning`;
    }
    return `border-2 ${style} border-success`;
  };
  const sameDayClass = sameDay(date, now())
    ? 'bg-neutral text-neutral-content'
    : '';
  const currentMonthClass = status !== 'current' ? 'text-base-300' : '';

  const calendarCellClass = () => {
    if (status !== 'current') {
      return '';
    }
    if (isHoliday(date)) {
      return 'text-red-400';
    }
    if (isWeekend(date)) {
      return 'text-blue-300';
    }
    return '';
  };

  return (
    <Link
      href={`/worklog-entry?day=${toISODay(date)}`}
      key={toISODay(date)}
      className={`${calendarDayItemClass} ${borderClass()} ${sameDayClass} ${currentMonthClass}`}
      prefetch={false}
    >
      <CalendarCell
        mainText={toDay(date)}
        subText={
          status === 'current' && hoursCompact ? `${hoursCompact}h` : undefined
        }
        absence={absence}
        className={calendarCellClass()}
      />
    </Link>
  );
}
