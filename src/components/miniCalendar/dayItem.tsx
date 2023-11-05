import { AbsenceReason } from '@/types';
import { isWeekend, now, sameDay, startOfDay } from '@/util/date';
import { toDay, toISODay } from '@/util/dateFormatter';
import Link from 'next/link';
import CalendarCell from './calendarCell';
import { CALENDAR_ITEM_CLASS } from './util';

const calendarDayItemClass = `${CALENDAR_ITEM_CLASS} cursor-pointer`;

export default function DayItem({
  date,
  status,
  saldo,
  absence,
  beginDate,
}: {
  date: Date;
  status: string;
  saldo: { hours: number; minutes: number; toString: () => string };
  absence?: AbsenceReason;
  beginDate: Date;
}) {
  const minutes = saldo.hours * 60 + saldo.minutes;
  const hoursCompact = Math.round((minutes * 10) / 60) / 10;
  const borderClass = () => {
    if (status !== 'current') {
      return '';
    }
    const beforeBegin = startOfDay(date) < startOfDay(beginDate);
    const inFuture = startOfDay(date) > startOfDay();
    if (beforeBegin || inFuture) {
      return minutes !== 0 ? 'border-2 border-solid border-base-300' : '';
    }

    if (isWeekend(date)) {
      return minutes ? 'border-2 border-solid border-info' : '';
    }
    if (minutes === 0) {
      return 'border-2 border-solid border-error';
    }
    if (minutes < 450) {
      return 'border-2 border-solid border-warning';
    }
    return 'border-2 border-solid border-success';
  };
  const sameDayClass = sameDay(date, now())
    ? 'bg-neutral text-neutral-content'
    : '';
  const currentMonthClass = status !== 'current' ? 'text-base-300' : '';

  return (
    <Link
      href={`/worklog-entry?day=${toISODay(date)}`}
      key={toISODay(date)}
      className={`${calendarDayItemClass} ${borderClass()} ${sameDayClass} ${currentMonthClass}`}
    >
      <CalendarCell
        mainText={toDay(date)}
        subText={
          status === 'current' && hoursCompact ? `${hoursCompact}h` : undefined
        }
        absence={absence}
      />
    </Link>
  );
}
