import { add, diffInMinutes, startOfDay } from '@/util/date';
import { Settings, Worklog } from '@prisma/client';

const EXPECTED_HOURS_PER_DAY = 7.5;

function expectedMinutesUntilToday(beginDate: Date) {
  const today = startOfDay(new Date());
  let d = beginDate;
  let workDays = 0;
  while (d.getTime() <= today.getTime()) {
    const weekDay = d.getDay();
    d = add(d, 1, 'day');
    if (weekDay === 0 || weekDay === 6) {
      continue;
    }
    workDays++;
  }
  return workDays * 60 * EXPECTED_HOURS_PER_DAY;
}
function minutesToSaldoObject(saldoInMinutes: number) {
  if (saldoInMinutes < 0) {
    return {
      hours: Math.ceil(saldoInMinutes / 60),
      minutes: Math.ceil(saldoInMinutes % 60),
      toString: () =>
        `-${Math.abs(Math.ceil(saldoInMinutes / 60))}h ${Math.abs(
          Math.ceil(saldoInMinutes % 60),
        )}min`,
    };
  }
  return {
    hours: Math.floor(saldoInMinutes / 60),
    minutes: Math.floor(saldoInMinutes % 60),
    toString: () =>
      `${Math.floor(saldoInMinutes / 60)}h ${Math.floor(
        saldoInMinutes % 60,
      )}min`,
  };
}

export function calculateCurrentSaldo(settings: Settings, worklogs: Worklog[]) {
  const worklogsSorted = [
    ...worklogs.sort((a, b) => b.from.getTime() - a.from.getTime()),
  ];

  const sum = worklogsSorted.reduce(
    (acc, worklogItem) => {
      return worklogItem.from.getTime() < settings.begin_date.getTime()
        ? acc
        : acc + diffInMinutes(worklogItem.to, worklogItem.from);
    },
    settings.initial_balance_hours * 60 + settings.initial_balance_mins,
  );

  const saldoInMinutes = sum - expectedMinutesUntilToday(settings.begin_date);
  return minutesToSaldoObject(saldoInMinutes);
}

export function calulateWorklogsSum(worklogs: Worklog[]) {
  const total = worklogs.reduce((sum, worklog) => {
    return sum + diffInMinutes(worklog.to, worklog.from);
  }, 0);
  return minutesToSaldoObject(total);
}
