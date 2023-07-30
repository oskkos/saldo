import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { assertIsISODay, assertIsTime } from './assertionFunctions';

dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

type Date_Day = string & { kind: 'Date_Day' };
export function toDay(date: Date) {
  return dayjs(date).format('D') as Date_Day;
}

type Date_DayMonthYear = string & { kind: 'Date_DayMonthYear' };
export function toDayMonthYear(date: Date_ISODay | Date) {
  const d = date instanceof Date ? date : date + 'T00:00:00.000Z';
  return dayjs(d).format('D.M.YYYY') as Date_DayMonthYear;
}

export type Date_ISODay = string & { kind: 'Date_ISODay' };
export function toISODay(date?: Date) {
  const x = dayjs(date).format('YYYY-MM-DD');
  assertIsISODay(x);
  return x;
}

type Date_MonthAndYear = string & { kind: 'Date_MonthAndYear' };
export function toMonthAndYear(date: Date_YearAndMonth | Date) {
  const d = date instanceof Date ? date : date + '-01T00:00:00.000Z';
  return dayjs(d).format('MMMM YYYY') as Date_MonthAndYear;
}

export type Date_Time = string & { kind: 'Date_Time' };
export function toTime(date: Date) {
  const x = dayjs.tz(date, 'UTC').format('HH:mm');
  assertIsTime(x);
  return x;
}

type Date_Week = number & { kind: 'Date_Week' };
export function toWeek(date: Date) {
  return parseInt(dayjs(date).format('W')) as Date_Week;
}

type Date_Weekday = number & { kind: 'Date_Weekday' };
export function toWeekday(date: Date) {
  return parseInt(dayjs(date).format('d')) as Date_Weekday;
}

type Date_YearAndWeek = string & { kind: 'Date_YearAndWeek' };
export function toYearAndWeek(date: Date) {
  return dayjs(date).format('YYYY-W') as Date_YearAndWeek;
}
export type Date_YearAndMonth = string & { kind: 'Date_YearAndMonth' };
export function toYearAndMonth(date: Date_ISODay | Date) {
  const d = date instanceof Date ? date : date + 'T00:00:00.000Z';
  return dayjs(d).format('YYYY-MM') as Date_YearAndMonth;
}
