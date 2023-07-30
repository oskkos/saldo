'use client';
import { useRef } from 'react';
import { MdArrowBack, MdArrowForward, MdToday } from 'react-icons/md';
import { add, startOfMonth, subtract } from '@/util/date';
import { toISODay, toMonthAndYear, toYearAndMonth } from '@/util/dateFormatter';
import { Worklog } from '@prisma/client';
import useSwipeEvents from 'beautiful-react-hooks/useSwipeEvents';
import { useRouter } from 'next/navigation';
import WeekItem from './weekItem';
import {
  CALENDAR_ICON_CLASS,
  CALENDAR_ITEM_CLASS,
  daysForCalendarBuilder,
} from './util';
import DayItem from './dayItem';

export default function MiniCalendar({
  date,
  beginDate,
  worklogs,
}: {
  date: Date;
  beginDate: Date;
  worklogs: Worklog[];
}) {
  const router = useRouter();
  const toCurrentMonth = () => {
    router.push('/');
  };
  const toPrevMonth = () => {
    router.push(
      `/?month=${toYearAndMonth(subtract(startOfMonth(date), 1, 'month'))}`,
    );
  };
  const toNextMonth = () => {
    router.push(
      `/?month=${toYearAndMonth(add(startOfMonth(date), 1, 'month'))}`,
    );
  };

  const ref = useRef<HTMLDivElement>(null);
  const { onSwipeLeft, onSwipeRight } = useSwipeEvents(ref, {
    threshold: 80,
    preventDefault: false,
  });
  onSwipeLeft(() => {
    toNextMonth();
  });
  onSwipeRight(() => {
    toPrevMonth();
  });

  const worklogsByDay = worklogs.reduce(
    (acc: Record<string, Worklog[] | undefined>, x) => {
      const day = toISODay(x.from);
      acc[day] = [...(acc[day] ?? []), x];
      return acc;
    },
    {},
  );

  return (
    <div className="grid gap-0.5 grid-cols-8 justify-items-center" ref={ref}>
      <div className={CALENDAR_ITEM_CLASS}>
        <MdArrowBack
          title="Previous month"
          className={CALENDAR_ICON_CLASS}
          onClick={toPrevMonth}
        />
      </div>
      <div className="col-span-5 flex justify-center items-center text-xl">
        {toMonthAndYear(date)}
      </div>
      <div className={CALENDAR_ITEM_CLASS}>
        <MdToday
          title="This month"
          className={CALENDAR_ICON_CLASS}
          onClick={toCurrentMonth}
        />
      </div>{' '}
      <div className={CALENDAR_ITEM_CLASS}>
        <MdArrowForward
          title="Next month"
          className={CALENDAR_ICON_CLASS}
          onClick={toNextMonth}
        />
      </div>
      {['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x, i) => (
        <div key={i}>{x}</div>
      ))}
      {daysForCalendarBuilder(date, worklogsByDay).reduce(
        (acc: JSX.Element[], day, index) => {
          if (index % 7 === 0) {
            acc.push(
              <WeekItem
                key={'w-' + day.date.getTime().toString()}
                date={day.date}
              />,
            );
          }
          acc.push(
            <DayItem
              key={'d-' + day.date.getTime().toString()}
              date={day.date}
              saldo={day.saldo}
              status={day.status}
              absence={day.absence}
              beginDate={beginDate}
            />,
          );
          return acc;
        },
        [],
      )}
    </div>
  );
}
