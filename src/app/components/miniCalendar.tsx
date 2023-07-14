'use client';
import { useState } from 'react';
import { MdArrowBack, MdArrowForward, MdToday } from 'react-icons/md';
import Link from 'next/link';
import {
  add,
  daysInMonth,
  endOfMonth,
  sameDay,
  startOfMonth,
  subtract,
} from '@/util/date';
import {
  toDay,
  toISODay,
  toMonthAndYear,
  toWeek,
  toWeekday,
  toYearAndWeek,
} from '@/util/dateFormatter';
import { Worklog } from '@prisma/client';
import { calculateWorklogsSum } from '@/services';

const calendarItemClass = 'w-10 h-10 flex justify-center items-center';
const calendarDayItemClass = `${calendarItemClass} cursor-pointer`;
const calendarIconClass = 'w-6 h-6 cursor-pointer';

const daysForCalendarBuilder = (
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
      return {
        date: prevD,
        status: 'prev',
        saldo: calculateWorklogsSum(worklogsByDay[toISODay(prevD)] ?? []),
      };
    });

  const currentMonthDates = Array(daysInMonth(d))
    .fill(null)
    .map((_, i) => {
      const currentD = add(startOfMonthDate, i, 'days');
      return {
        date: currentD,
        status: 'current',
        saldo: calculateWorklogsSum(worklogsByDay[toISODay(currentD)] ?? []),
      };
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
            return {
              date: nextD,
              status: 'next',
              saldo: calculateWorklogsSum(worklogsByDay[toISODay(nextD)] ?? []),
            };
          });

  return [...prevMonthDates, ...currentMonthDates, ...nextMonthDates];
};
const weekItem = (date: Date) => {
  return (
    <div
      className={`${calendarItemClass} text-base-300`}
      key={toYearAndWeek(date)}
    >
      {toWeek(date)}
    </div>
  );
};
const dayItem = (
  {
    date,
    status,
    saldo,
  }: {
    date: Date;
    status: string;
    saldo: { hours: number; minutes: number; toString: () => string };
  },
  beginDate: Date,
) => {
  const minutes = saldo.hours * 60 + saldo.minutes;
  const hoursCompact = Math.round((minutes * 10) / 60) / 10;
  const borderClass = () => {
    if (status !== 'current') {
      return '';
    }
    const beforeBegin = date.getTime() < beginDate.getTime();
    const inFuture = date.getTime() > new Date().getTime();
    if (beforeBegin || inFuture) {
      return minutes !== 0
        ? 'rounded-full border-2 border-solid border-base-300'
        : '';
    }

    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    if (isWeekend) {
      return minutes ? 'rounded-full border-2 border-solid border-info' : '';
    }
    if (minutes === 0) {
      return 'rounded-full border-2 border-solid border-error';
    }
    if (minutes < 450) {
      return 'rounded-full border-2 border-solid border-warning';
    }
    return 'rounded-full border-2 border-solid border-success';
  };
  const sameDayClass = sameDay(date, new Date())
    ? 'bg-neutral text-neutral-content'
    : '';
  const currentMonthClass = status !== 'current' ? 'text-base-300' : '';

  return (
    <Link
      href={`/worklog-entry?day=${toISODay(date)}`}
      key={toISODay(date)}
      className={`${calendarDayItemClass} ${borderClass()} ${sameDayClass} ${currentMonthClass}`}
    >
      <div className="flex flex-col justify-center items-center">
        <div>{toDay(date)}</div>
        <div className="text-[10px]/[0.75rem]">
          {status === 'current' && hoursCompact ? hoursCompact : '\u00A0'}
        </div>
      </div>
    </Link>
  );
};
export default function MiniCalendar({
  date,
  beginDate,
  worklogs,
}: {
  date: Date;
  beginDate: Date;
  worklogs: Worklog[];
}) {
  const [d, setD] = useState(date);

  const worklogsByDay = worklogs.reduce(
    (acc: Record<string, Worklog[] | undefined>, x) => {
      const day = toISODay(x.from);
      acc[day] = [...(acc[day] ?? []), x];
      return acc;
    },
    {},
  );

  const daysForCalendar = daysForCalendarBuilder(d, worklogsByDay);
  return (
    <div className="grid gap-0.5 grid-cols-8 justify-items-center">
      <div className={calendarItemClass}>
        <MdArrowBack
          title="Previous month"
          className={calendarIconClass}
          onClick={() => {
            setD(subtract(d, 1, 'month'));
          }}
        />
      </div>
      <div className="col-span-5 flex justify-center items-center text-xl">
        {toMonthAndYear(d)}
      </div>
      <div className={calendarItemClass}>
        <MdToday
          title="today"
          className={calendarIconClass}
          onClick={() => {
            setD(new Date());
          }}
        />
      </div>{' '}
      <div className={calendarItemClass}>
        <MdArrowForward
          title="Next month"
          className={calendarIconClass}
          onClick={() => {
            setD(add(d, 1, 'month'));
          }}
        />
      </div>
      {['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x, i) => (
        <div key={i}>{x}</div>
      ))}
      {daysForCalendar.reduce((acc: JSX.Element[], day, index) => {
        if (index % 7 === 0) {
          acc.push(weekItem(day.date));
        }
        acc.push(dayItem(day, beginDate));
        return acc;
      }, [])}
    </div>
  );
}
