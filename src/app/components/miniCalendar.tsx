'use client';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import { useState } from 'react';
import { MdArrowBack, MdArrowForward, MdToday } from 'react-icons/md';
import Link from 'next/link';

dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);

const calendarItemClass = 'w-10 h-10 flex justify-center items-center';
const calendarDayItemClass = `${calendarItemClass} cursor-pointer`;
const calendarIconClass = 'w-6 h-6 cursor-pointer';

const daysForCalendarBuilder = (d: Dayjs) => {
  const beginOfMonth = d.startOf('month');
  const prevMonthDateAmount =
    parseInt(beginOfMonth.format('d')) === 0
      ? 6
      : parseInt(beginOfMonth.format('d')) - 1;
  const prevMonthDates = Array(prevMonthDateAmount)
    .fill(null)
    .map((_, i) => {
      const prevD = beginOfMonth.subtract(prevMonthDateAmount - i, 'days');
      return {
        date: prevD,
        status: 'prev',
      };
    });

  const daysInMonth = d.daysInMonth();
  const currentMonthDates = Array(daysInMonth)
    .fill(null)
    .map((_, i) => {
      const currentD = beginOfMonth.add(i, 'days');
      return {
        date: currentD,
        status: 'current',
      };
    });

  const endOfMonth = d.endOf('month');
  const nextMonthDateAmount =
    7 - ((prevMonthDates.length + currentMonthDates.length) % 7);
  const nextMonthDates =
    nextMonthDateAmount === 7
      ? []
      : Array(nextMonthDateAmount)
          .fill(null)
          .map((_, i) => {
            const nextD = endOfMonth.add(i + 1, 'days');
            return {
              date: nextD,
              status: 'next',
            };
          });

  return [...prevMonthDates, ...currentMonthDates, ...nextMonthDates];
};
const weekItem = (date: Dayjs) => {
  return (
    <div
      className={`${calendarItemClass} text-base-300`}
      key={date.format('YYYY-W')}
    >
      {date.format('W')}
    </div>
  );
};
const dayItem = (date: Dayjs, status: string) => {
  return (
    <Link
      href={`/worklog-entry?day=${date.format('YYYY-MM-DD')}`}
      key={date.format('YYYY-MM-DD')}
      className={
        date.isSame(dayjs(), 'day')
          ? `rounded-full border-2 border-solid ${calendarDayItemClass}`
          : status === 'current'
          ? calendarDayItemClass
          : `text-base-300 ${calendarDayItemClass}`
      }
    >
      {date.format('D')}
    </Link>
  );
};
export default function MiniCalendar({ date }: { date?: Date }) {
  const [d, setD] = useState(dayjs(date));

  const daysForCalendar = daysForCalendarBuilder(d);
  return (
    <div className="grid grid-cols-8 justify-items-center">
      <div className={calendarItemClass}>
        <MdArrowBack
          title="Previous month"
          className={calendarIconClass}
          onClick={() => {
            setD(d.subtract(1, 'month'));
          }}
        />
      </div>
      <div className="col-span-5 flex justify-center items-center text-xl">
        {d.format('MMMM YYYY')}
      </div>
      <div className={calendarItemClass}>
        <MdToday
          title="today"
          className={calendarIconClass}
          onClick={() => {
            setD(dayjs());
          }}
        />
      </div>{' '}
      <div className={calendarItemClass}>
        <MdArrowForward
          title="Next month"
          className={calendarIconClass}
          onClick={() => {
            setD(d.add(1, 'month'));
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
