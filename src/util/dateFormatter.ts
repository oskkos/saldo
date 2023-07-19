// All formatting on client to ensure proper timezone
'use client';
import dayjs from 'dayjs';
import { assertIsISODay, assertIsTime } from './assertionFunctions';

type Date_Day = string & { kind: 'Date_Day' };
export function toDay(date: string | number | Date) {
  return dayjs(date).format('D') as Date_Day;
}

type Date_DayMonthYear = string & { kind: 'Date_DayMonthYear' };
export function toDayMonthYear(date: string | number | Date) {
  return dayjs(date).format('D.M.YYYY') as Date_DayMonthYear;
}

export type Date_ISODay = string & { kind: 'Date_ISODay' };
export function toISODay(date: string | number | Date) {
  const x = dayjs(date).format('YYYY-MM-DD');
  assertIsISODay(x);
  return x;
}

type Date_MonthAndYear = string & { kind: 'Date_MonthAndYear' };
export function toMonthAndYear(date: string | number | Date) {
  return dayjs(date).format('MMMM YYYY') as Date_MonthAndYear;
}

export type Date_Time = string & { kind: 'Date_Time' };
export function toTime(date: string | number | Date) {
  const x = dayjs(date).format('HH:mm');
  assertIsTime(x);
  return x;
}

type Date_Week = number & { kind: 'Date_Week' };
export function toWeek(date: string | number | Date) {
  return parseInt(dayjs(date).format('W')) as Date_Week;
}

type Date_Weekday = number & { kind: 'Date_Weekday' };
export function toWeekday(date: string | number | Date) {
  return parseInt(dayjs(date).format('d')) as Date_Weekday;
}

type Date_YearAndWeek = string & { kind: 'Date_YearAndWeek' };
export function toYearAndWeek(date: string | number | Date) {
  return dayjs(date).format('YYYY-W') as Date_YearAndWeek;
}
type Date_YearAndMonth = string & { kind: 'Date_YearAndMonth' };
export function toYearAndMonth(date: string | number | Date) {
  return dayjs(date).format('YYYY-MM') as Date_YearAndMonth;
}
