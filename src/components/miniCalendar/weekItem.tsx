import { toWeek, toYearAndWeek } from '@/util/dateFormatter';
import { CALENDAR_ITEM_CLASS } from './util';
import CalendarCell from './calendarCell';

export default function WeekItem({ date }: { date: Date }) {
  return (
    <div
      className={`${CALENDAR_ITEM_CLASS} text-base-300 sm:text-lg`}
      key={toYearAndWeek(date)}
    >
      <CalendarCell mainText={toWeek(date)} />
    </div>
  );
}
