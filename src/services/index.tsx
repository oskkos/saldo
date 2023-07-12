import { add, startOfDay } from '@/util/date';
import { Settings, Worklog } from '@prisma/client';

const EXPECTED_HOURS_PER_DAY = 7.5;

export function calculateCurrentSaldo(
  settings: Settings,
  worklogItems: Worklog[],
) {
  let sum = settings.initial_balance_hours * 60 + settings.initial_balance_mins;
  const itemsSorted = [
    ...worklogItems.sort((a, b) => b.from.getTime() - a.from.getTime()),
  ];

  for (const item of itemsSorted) {
    if (item.from.getTime() < settings.begin_date.getTime()) {
      continue;
    }
    const elapsedInMinutes = Math.round(
      (item.to.getTime() - item.from.getTime()) / 1000 / 60,
    );
    sum = sum + elapsedInMinutes;
  }
  const today = startOfDay(new Date());
  let d = settings.begin_date;
  let workDays = 0;
  while (d.getTime() <= today.getTime()) {
    const weekDay = d.getDay();
    d = add(d, 1, 'day');
    if (weekDay === 0 || weekDay === 6) {
      continue;
    }
    workDays++;
  }
  const expectedInMinutes = workDays * 60 * EXPECTED_HOURS_PER_DAY;
  const saldoInMinutes = sum - expectedInMinutes;
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
