import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { Date_ISODay, Date_Time } from './dateFormatter';

dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('UTC');

export function add(
  date: string | number | Date,
  value: number,
  unit: dayjs.ManipulateType,
) {
  return dayjs.tz(date).add(value, unit).toDate();
}

export function daysInMonth(date: Date) {
  return dayjs.tz(date).daysInMonth();
}

export function diffInMinutes(
  date1: string | number | Date,
  date2: string | number | Date,
) {
  return dayjs.tz(date1).diff(date2, 'm');
}

export function endOfDay(date?: string | number | Date) {
  return dayjs.tz(date).endOf('day').toDate();
}

export function endOfMonth(date: Date) {
  return dayjs.tz(date).endOf('month').toDate();
}

export function sameDay(date1: Date, date2: Date) {
  return dayjs.tz(date1).isSame(dayjs.tz(date2), 'day');
}

export function startOfDay(date?: string | number | Date) {
  return dayjs.tz(date).startOf('day').toDate();
}

export function startOfMonth(date?: string | number | Date) {
  return dayjs.tz(date).startOf('month').toDate();
}
export function now() {
  return dayjs.tz().toDate();
}

export function subtract(
  date: string | number | Date,
  value: number,
  unit: dayjs.ManipulateType,
) {
  return dayjs.tz(date).subtract(value, unit).toDate();
}

export function toDate(day: Date_ISODay, time: Date_Time) {
  return dayjs.tz(`${day} ${time}`).toDate();
}
