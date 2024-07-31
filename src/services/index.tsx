import {
  EXPECTED_HOURS_PER_DAY,
  EXPECTED_MINUTES_LUNCH_BREAK,
} from '@/constants';
import { AbsenceReason, SaldoForDay, Settings, Worklog } from '@/types';
import {
  add,
  diffInMinutes,
  endOfDay,
  isNonWorkingDay,
  startOfDay,
} from '@/util/date';

function expectedMinutesUntilToday(beginDate: Date) {
  const today = startOfDay();
  let d = beginDate;
  let workDays = 0;
  while (d.getTime() <= today.getTime()) {
    const nonWorkingDay = isNonWorkingDay(d);
    d = add(d, 1, 'day');
    if (nonWorkingDay) {
      continue;
    }
    workDays++;
  }
  return workDays * 60 * EXPECTED_HOURS_PER_DAY;
}
export function minutesToSaldoObject(saldoInMinutes: number): SaldoForDay {
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
export function worklogMinutes(worklogItem: Worklog) {
  return (
    diffInMinutes(worklogItem.to, worklogItem.from) -
    (worklogItem.subtractLunchBreak ? EXPECTED_MINUTES_LUNCH_BREAK : 0)
  );
}
export function calculateCurrentSaldo(settings: Settings, worklogs: Worklog[]) {
  const sum = sortWorklogs(worklogs).reduce(
    (acc, worklogItem) => {
      if (worklogItem.from.getTime() < settings.beginDate.getTime()) {
        return acc;
      }
      if (worklogItem.to.getTime() > endOfDay().getTime()) {
        return acc;
      }
      if (worklogItem.absence === AbsenceReason.flex_hours) {
        return acc;
      }
      if (worklogItem.absence) {
        return isNonWorkingDay(worklogItem.from)
          ? acc
          : acc + EXPECTED_HOURS_PER_DAY * 60;
      }
      return acc + worklogMinutes(worklogItem);
    },
    settings.initialBalanceHours * 60 + settings.initialBalanceMins,
  );
  const saldoInMinutes = sum - expectedMinutesUntilToday(settings.beginDate);
  return minutesToSaldoObject(saldoInMinutes);
}

export function calculateWorklogsSum(worklogs: Worklog[]) {
  const total = worklogs.reduce((sum, worklog) => {
    return sum + worklogMinutes(worklog);
  }, 0);
  return minutesToSaldoObject(total);
}

export function sortWorklogs(worklogs: Worklog[]) {
  return [...worklogs].sort((a, b) => b.from.getTime() - a.from.getTime());
}
export function absenceReasonToString(reason: AbsenceReason) {
  return (reason.charAt(0).toUpperCase() + reason.slice(1)).replaceAll(
    '_',
    ' ',
  );
}
