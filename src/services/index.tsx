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
import {
  Date_ISODay,
  toDayMonthYear,
  toISODay,
  toTime,
} from '@/util/dateFormatter';

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

// The inclusive UTC calendar days a from/to pair spans. Both ends are taken
// down to their start of day, so the times carried by an absence range (which
// are the user's default work hours, not range boundaries) cannot shorten or
// lengthen it.
export function daysInRange(from: Date, to: Date): Date_ISODay[] {
  const days: Date_ISODay[] = [];
  const last = startOfDay(to).getTime();
  let day = startOfDay(from);
  while (day.getTime() <= last) {
    days.push(toISODay(day));
    day = add(day, 1, 'day');
  }
  return days;
}

// A month-long range can collide on every day; naming them all would produce a
// toast nobody reads. Name the first few and count the rest.
const MAX_LISTED_CONFLICT_DAYS = 3;

// Thrown by the write paths so callers can tell a rejected absence apart from a
// genuine failure. That distinction matters at the action boundary: this
// message is meant for the user, and everything else is not.
export class AbsenceConflictError extends Error {
  readonly days: Date_ISODay[];

  constructor(days: Date_ISODay[]) {
    super(absenceConflictMessage(days));
    this.name = 'AbsenceConflictError';
    this.days = days;
  }
}

export function absenceConflictMessage(days: Date_ISODay[]) {
  if (days.length === 0) {
    return 'An absence is already recorded for the selected days.';
  }
  const listed = days.slice(0, MAX_LISTED_CONFLICT_DAYS).map(toDayMonthYear);
  const remaining = days.length - listed.length;
  const rest =
    remaining > 0
      ? ` and ${remaining} more ${remaining === 1 ? 'day' : 'days'}`
      : '';
  return `An absence is already recorded for ${listed.join(', ')}${rest}.`;
}

// Spans are half-open: [from, to). Two entries collide only when each begins
// strictly before the other ends, so back-to-back entries (08:00-12:00 followed
// by 12:00-16:00) do not — an inclusive comparison would flag every one of them.
export function spansOverlap(
  a: { from: Date; to: Date },
  b: { from: Date; to: Date },
) {
  return a.from.getTime() < b.to.getTime() && b.from.getTime() < a.to.getTime();
}

// Naming every collision would produce a toast nobody reads; the prompt only
// needs enough for the user to recognise what they are about to double-log.
const MAX_LISTED_CONFLICT_SPANS = 3;

// Thrown by the write paths so the action boundary can tell a rejected overlap
// apart from a genuine failure. Unlike an absence conflict, this one is a
// question rather than a verdict: the user may confirm through it, and the
// action re-runs the write with the overlap allowed.
export class WorklogOverlapError extends Error {
  readonly spans: { from: Date; to: Date }[];

  constructor(spans: { from: Date; to: Date }[]) {
    super(worklogOverlapMessage(spans));
    this.name = 'WorklogOverlapError';
    this.spans = spans;
  }
}

export function worklogOverlapMessage(spans: { from: Date; to: Date }[]) {
  if (spans.length === 0) {
    return 'This overlaps hours you have already logged.';
  }
  const listed = spans
    .slice(0, MAX_LISTED_CONFLICT_SPANS)
    .map((span) => `${toDayMonthYear(span.from)} ${formatSpan(span)}`);
  const remaining = spans.length - listed.length;
  const rest =
    remaining > 0
      ? ` and ${remaining} more ${remaining === 1 ? 'entry' : 'entries'}`
      : '';
  return `This overlaps ${listed.join(', ')}${rest}.`;
}

function formatSpan(span: { from: Date; to: Date }) {
  return `${toTime(span.from)}–${toTime(span.to)}`;
}
