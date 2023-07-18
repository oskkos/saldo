import {
  EXPECTED_HOURS_PER_DAY,
  EXPECTED_MINUTES_LUNCH_BREAK,
} from '@/constants';
import { AbsenceReason, SaldoForDay } from '@/types';
import { add, diffInMinutes, endOfDay, startOfDay } from '@/util/date';
import { Settings, Worklog } from '@prisma/client';

function isWeekend(d: Date) {
  const weekDay = d.getDay();
  return weekDay === 0 || weekDay === 6;
}

function expectedMinutesUntilToday(beginDate: Date) {
  const today = startOfDay(new Date());
  let d = beginDate;
  let workDays = 0;
  while (d.getTime() <= today.getTime()) {
    const weekend = isWeekend(d);
    d = add(d, 1, 'day');
    if (weekend) {
      continue;
    }
    workDays++;
  }
  return workDays * 60 * EXPECTED_HOURS_PER_DAY;
}
function minutesToSaldoObject(saldoInMinutes: number): SaldoForDay {
  if (saldoInMinutes < 0) {
    const negativeStr = `-${Math.abs(
      Math.ceil(saldoInMinutes / 60),
    )}h ${Math.abs(Math.ceil(saldoInMinutes % 60))}min`;
    return {
      hours: Math.ceil(saldoInMinutes / 60),
      minutes: Math.ceil(saldoInMinutes % 60),
      toString: () => negativeStr,
      toBadge: (className = '') => (
        <div className={`badge badge-error ${className}`}>{negativeStr}</div>
      ),
    };
  }
  const positiveStr = `${Math.floor(saldoInMinutes / 60)}h ${Math.floor(
    saldoInMinutes % 60,
  )}min`;
  return {
    hours: Math.floor(saldoInMinutes / 60),
    minutes: Math.floor(saldoInMinutes % 60),
    toString: () => positiveStr,
    toBadge: (className = '') => (
      <div className={`badge badge-success ${className}`}>{positiveStr}</div>
    ),
  };
}

export function calculateCurrentSaldo(settings: Settings, worklogs: Worklog[]) {
  const sum = sortWorklogs(worklogs).reduce(
    (acc, worklogItem) => {
      if (worklogItem.from.getTime() < settings.begin_date.getTime()) {
        return acc;
      }
      if (worklogItem.to.getTime() > endOfDay(new Date()).getTime()) {
        return acc;
      }
      if (worklogItem.absence === AbsenceReason.flex_hours) {
        return acc;
      }
      if (worklogItem.absence) {
        return isWeekend(worklogItem.from)
          ? acc
          : acc + EXPECTED_HOURS_PER_DAY * 60;
      }
      return (
        acc +
        diffInMinutes(worklogItem.to, worklogItem.from) -
        (worklogItem.subtract_lunch_break ? EXPECTED_MINUTES_LUNCH_BREAK : 0)
      );
    },
    settings.initial_balance_hours * 60 + settings.initial_balance_mins,
  );
  const saldoInMinutes = sum - expectedMinutesUntilToday(settings.begin_date);
  return minutesToSaldoObject(saldoInMinutes);
}

export function calculateWorklogsSum(worklogs: Worklog[]) {
  const total = worklogs.reduce((sum, worklog) => {
    return (
      sum +
      diffInMinutes(worklog.to, worklog.from) -
      (worklog.subtract_lunch_break ? EXPECTED_MINUTES_LUNCH_BREAK : 0)
    );
  }, 0);
  return minutesToSaldoObject(total);
}

export function sortWorklogs(worklogs: Worklog[]) {
  return [...worklogs].sort((a, b) => b.from.getTime() - a.from.getTime());
}
