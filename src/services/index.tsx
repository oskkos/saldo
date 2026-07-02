import { EXPECTED_MINUTES_LUNCH_BREAK } from '@/constants';
import {
  AbsenceReason,
  ExpectedHoursOverride,
  SaldoForDay,
  Settings,
  Worklog,
} from '@/types';
import {
  add,
  diffInMinutes,
  endOfDay,
  isNonWorkingDay,
  startOfDay,
} from '@/util/date';
import { Date_ISODay, toISODay } from '@/util/dateFormatter';

// Index the per-date overrides by UTC calendar day for O(1) lookup.
export function expectedMinutesByDay(
  overrides: ExpectedHoursOverride[],
): Map<Date_ISODay, number> {
  return overrides.reduce((acc, o) => {
    acc.set(toISODay(o.date), o.minutes);
    return acc;
  }, new Map<Date_ISODay, number>());
}

// The single source of truth for how many minutes are expected on a given day:
// a per-date override wins, otherwise a non-working day expects 0, otherwise the
// user's configurable default. Used by the balance accrual, the absence credit,
// and the mini-calendar coloring.
export function resolveExpectedMinutes(
  date: Date,
  defaultMinutes: number,
  overrideByDay: Map<Date_ISODay, number>,
): number {
  const override = overrideByDay.get(toISODay(date));
  if (override !== undefined) {
    return override;
  }
  if (isNonWorkingDay(date)) {
    return 0;
  }
  return defaultMinutes;
}

function expectedMinutesUntilToday(
  beginDate: Date,
  defaultMinutes: number,
  overrideByDay: Map<Date_ISODay, number>,
) {
  const today = startOfDay();
  let d = beginDate;
  let total = 0;
  while (d.getTime() <= today.getTime()) {
    total += resolveExpectedMinutes(d, defaultMinutes, overrideByDay);
    d = add(d, 1, 'day');
  }
  return total;
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
export function calculateCurrentSaldo(
  settings: Settings,
  worklogs: Worklog[],
  overrides: ExpectedHoursOverride[],
) {
  const overrideByDay = expectedMinutesByDay(overrides);
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
        // Credit exactly the day's resolved expected so the day nets to zero:
        // 0 on a non-working day (no override), the resolved value otherwise.
        return (
          acc +
          resolveExpectedMinutes(
            worklogItem.from,
            settings.expectedMinutesPerDay,
            overrideByDay,
          )
        );
      }
      return acc + worklogMinutes(worklogItem);
    },
    settings.initialBalanceHours * 60 + settings.initialBalanceMins,
  );
  const saldoInMinutes =
    sum -
    expectedMinutesUntilToday(
      settings.beginDate,
      settings.expectedMinutesPerDay,
      overrideByDay,
    );
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
