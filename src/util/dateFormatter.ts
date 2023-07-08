// All formatting on client to ensure proper timezone
'use client';
import dayjs from 'dayjs';

export function toDay(date: string | number | Date) {
  return dayjs(date).format('D');
}

export function toDayMonthYear(date: string | number | Date) {
  return dayjs(date).format('D.M.YYYY');
}

export function toISODay(date: string | number | Date) {
  return dayjs(date).format('YYYY-MM-DD');
}

export function toMonthAndYear(date: string | number | Date) {
  return dayjs(date).format('MMMM YYYY');
}

export function toTime(date: string | number | Date) {
  return dayjs(date).format('HH:mm');
}

export function toWeek(date: string | number | Date) {
  return parseInt(dayjs(date).format('W'));
}

export function toWeekday(date: string | number | Date) {
  return parseInt(dayjs(date).format('d'));
}

export function toYearAndWeek(date: string | number | Date) {
  return dayjs(date).format('YYYY-W');
}
