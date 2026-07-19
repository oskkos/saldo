import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
  Date_ISODay,
  Date_Time,
  Date_YearAndMonth,
  toISODay,
} from './dateFormatter';
import Holidays from 'date-holidays';

dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('UTC');

// Reinterpret a wall-clock time AS UTC, keeping the clock value (the `true` is
// keepLocalTime). Used only by toDate for the storage/entry path: an entered
// 08:00 is persisted as 08:00Z, with no timezone conversion. Do NOT switch this
// to dayjs.utc() — that would convert the instant and shift stored times by the
// runtime offset. (Read-side helpers use dayjs.utc, which is the correct dual.)
function tzWrapper(d: Dayjs) {
  return dayjs(d).tz('UTC', true);
}

export function add(
  date: Date_ISODay | Date,
  value: number,
  unit: 'day' | 'month' | 'year' | 'hour',
) {
  const d = date instanceof Date ? date : date + 'T00:00:00.000Z';
  return dayjs.utc(d).add(value, unit).toDate();
}

export function daysInMonth(date: Date) {
  return dayjs.utc(date).daysInMonth();
}

export function diffInMinutes(date1: Date, date2: Date) {
  return dayjs(date1).diff(date2, 'm');
}

export function endOfDay(date?: Date_ISODay | Date) {
  return dayjs.utc(date).endOf('day').toDate();
}

export function endOfMonth(date: Date) {
  return dayjs.utc(date).endOf('month').toDate();
}

export function sameDay(date1: Date, date2: Date) {
  return dayjs.tz(date1).isSame(dayjs.tz(date2), 'day');
}

export function startOfDay(date?: Date_ISODay | Date) {
  return dayjs.utc(date).startOf('day').toDate();
}

export function startOfMonth(date?: Date_YearAndMonth | Date) {
  return dayjs.utc(date).startOf('month').toDate();
}
export function now() {
  // Like toDate, now() produces a *current wall-clock* value as a UTC instant
  // (keepLocalTime), NOT the true UTC moment. This keeps it consistent with how
  // worklogs are stored, so the client mini-calendar highlights the user's local
  // "today". Do NOT switch this to dayjs.utc() — that highlights the UTC day,
  // which is wrong for non-UTC browsers near midnight.
  return tzWrapper(dayjs()).toDate();
}

export function subtract(
  date: Date_ISODay | Date,
  value: number,
  unit: 'day' | 'month' | 'year',
) {
  const d = date instanceof Date ? date : date + 'T00:00:00.000Z';
  return dayjs.utc(d).subtract(value, unit).toDate();
}

export function toDate(day: Date_ISODay, time: Date_Time) {
  return tzWrapper(dayjs(`${day} ${time}`)).toDate();
}

export function isWeekend(date: Date) {
  return date.getUTCDay() === 0 || date.getUTCDay() === 6;
}

// Constructing `new Holidays('FI')` and resolving holidays per call is ~1ms —
// done once per day across the beginDate→today saldo loop, it dominated render
// time (O(days)). Build the instance once and memoize each year's public
// holidays as a Set of UTC day strings, so a per-day check is an O(1) lookup.
const finHolidays = new Holidays('FI');
const publicHolidaysByYear = new Map<number, Set<string>>();

function publicHolidaysForYear(year: number): Set<string> {
  const cached = publicHolidaysByYear.get(year);
  if (cached) {
    return cached;
  }
  const set = new Set(
    (finHolidays.getHolidays(year) || [])
      .filter((h) => h.type === 'public')
      .map((h) => h.date.slice(0, 10)),
  );
  publicHolidaysByYear.set(year, set);
  return set;
}

export function isHoliday(date: Date) {
  return publicHolidaysForYear(date.getUTCFullYear()).has(toISODay(date));
}

export function isNonWorkingDay(date: Date) {
  return isWeekend(date) || isHoliday(date);
}

export function timeIsGt(a: Date_Time, b: Date_Time) {
  const a_split = a.split(':');
  const b_split = b.split(':');

  if (parseInt(a_split[0]) > parseInt(b_split[0])) {
    return true;
  } else if (parseInt(a_split[0]) === parseInt(b_split[0])) {
    if (parseInt(a_split[1]) > parseInt(b_split[1])) {
      return true;
    }
  }
  return false;
}
