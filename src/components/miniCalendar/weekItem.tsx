import { toWeek, toYearAndWeek } from '@/util/dateFormatter';
import { CALENDAR_ITEM_CLASS } from './util';
import CalendarCell from './calendarCell';

export default function WeekItem({ date }: { date: Date }) {
  return (
    <div className={`${CALENDAR_ITEM_CLASS}`} key={toYearAndWeek(date)}>
      <CalendarCell mainText={toWeek(date)} className="text-accent text-xs" />
    </div>
  );
}
