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

const calendarItemClass = 'w-10 h-10 flex justify-center items-center';
const calendarDayItemClass = `${calendarItemClass} cursor-pointer`;
const calendarIconClass = 'w-6 h-6 cursor-pointer';

const daysForCalendarBuilder = (d: Date) => {
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
      };
    });

  const currentMonthDates = Array(daysInMonth(d))
    .fill(null)
    .map((_, i) => {
      const currentD = add(startOfMonthDate, i, 'days');
      return {
        date: currentD,
        status: 'current',
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
const dayItem = (date: Date, status: string) => {
  return (
    <Link
      href={`/worklog-entry?day=${toISODay(date)}`}
      key={toISODay(date)}
      className={
        sameDay(date, new Date())
          ? `rounded-full border-2 border-solid ${calendarDayItemClass}`
          : status === 'current'
          ? calendarDayItemClass
          : `text-base-300 ${calendarDayItemClass}`
      }
    >
      {toDay(date)}
    </Link>
  );
};
export default function MiniCalendar({ date }: { date: Date }) {
  const [d, setD] = useState(date);

  const daysForCalendar = daysForCalendarBuilder(d);
  return (
    <div className="grid grid-cols-8 justify-items-center">
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
        acc.push(dayItem(day.date, day.status));
        return acc;
      }, [])}
    </div>
  );
}
