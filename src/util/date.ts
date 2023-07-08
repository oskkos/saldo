import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);

export function add(date: Date, value: number, unit: dayjs.ManipulateType) {
  return dayjs(date).add(value, unit).toDate();
}

export function daysInMonth(date: Date) {
  return dayjs(date).daysInMonth();
}

export function diffInMinutes(date1: Date, date2: Date) {
  return dayjs(date1).diff(date2, 'm');
}

export function endOfDay(date: string | number | Date) {
  return dayjs(date).endOf('day').toDate();
}

export function endOfMonth(date: Date) {
  return dayjs(date).endOf('month').toDate();
}

export function sameDay(date1: Date, date2: Date) {
  return dayjs(date1).isSame(dayjs(date2), 'day');
}

export function startOfDay(date: string | number | Date) {
  return dayjs(date).startOf('day').toDate();
}

export function startOfMonth(date: Date) {
  return dayjs(date).startOf('month').toDate();
}

export function subtract(
  date: Date,
  value: number,
  unit: dayjs.ManipulateType,
) {
  return dayjs(date).subtract(value, unit).toDate();
}

export function toDate(value: string) {
  return dayjs(value).toDate();
}
