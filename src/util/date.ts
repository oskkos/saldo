import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { Date_ISODay, Date_Time, Date_YearAndMonth } from './dateFormatter';

dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('UTC');

function tzWrapper(d: Dayjs) {
  return dayjs(d).tz('UTC', true);
}

export function add(
  date: Date_ISODay | Date,
  value: number,
  unit: 'day' | 'month' | 'year' | 'hour',
) {
  const d = date instanceof Date ? date : date + 'T00:00:00.000Z';
  return dayjs(d).add(value, unit).toDate();
}

export function daysInMonth(date: Date) {
  return tzWrapper(dayjs(date)).daysInMonth();
}

export function diffInMinutes(date1: Date, date2: Date) {
  return dayjs(date1).diff(date2, 'm');
}

export function endOfDay(date?: Date_ISODay | Date) {
  return tzWrapper(dayjs(date).endOf('day')).toDate();
}

export function endOfMonth(date: Date) {
  return tzWrapper(dayjs(date).endOf('month')).toDate();
}

export function sameDay(date1: Date, date2: Date) {
  return dayjs.tz(date1).isSame(dayjs.tz(date2), 'day');
}

export function startOfDay(date?: Date_ISODay | Date) {
  return tzWrapper(dayjs(date).startOf('day')).toDate();
}

export function startOfMonth(date?: Date_YearAndMonth | Date) {
  return tzWrapper(dayjs(date).startOf('month')).toDate();
}
export function now() {
  return tzWrapper(dayjs()).toDate();
}

export function subtract(
  date: Date_ISODay | Date,
  value: number,
  unit: 'day' | 'month' | 'year',
) {
  const d = date instanceof Date ? date : date + 'T00:00:00.000Z';
  return dayjs(d).subtract(value, unit).toDate();
}

export function toDate(day: Date_ISODay, time: Date_Time) {
  return tzWrapper(dayjs(`${day} ${time}`)).toDate();
}
