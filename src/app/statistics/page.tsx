import { getUserFromSession } from '@/auth/authSession';
import { getWorklogs } from '@/repository/worklogRepository';
import {
  absenceReasonToString,
  minutesToSaldoObject,
  worklogMinutes,
} from '@/services';
import { SaldoForDay } from '@/types';
import { assertIsISODay } from '@/util/assertionFunctions';
import { Date_ISODay, toDayMonthYear, toISODay } from '@/util/dateFormatter';
import WorkMinutesPerDayChart from './workMinutesPerDayChart';
import { Absence, Worklog } from '@prisma/client';
import { getSettings } from '@/repository/userRepository';
import { endOfDay } from '@/util/date';

async function getWorklogData(userId: number, beginDate: Date) {
  const worklogs = await getWorklogs(userId);
  const { workDayWorklogs, absenceWorklogs } = worklogs.reduce(
    (acc, worklog) => {
      if (worklog.from.getTime() < beginDate.getTime()) {
        return acc;
      }
      if (worklog.to.getTime() > endOfDay().getTime()) {
        return acc;
      }

      const array = worklog.absence ? acc.absenceWorklogs : acc.workDayWorklogs;
      array.push(worklog);
      return acc;
    },
    {
      workDayWorklogs: [] as Worklog[],
      absenceWorklogs: [] as Worklog[],
    },
  );
  const totalWorkMinutes = workDayWorklogs
    .map(worklogMinutes)
    .reduce((a, b) => a + b);

  const workMinutesPerDay = workDayWorklogs.reduce(
    (acc, x) => {
      const day = toISODay(x.from);
      return acc.set(day, (acc.get(day) || 0) + worklogMinutes(x));
    },
    new Map() as Map<string, number>,
  );

  const absenceMap = absenceWorklogs.reduce(
    (acc, x) => {
      return x.absence
        ? acc.set(x.absence, (acc.get(x.absence) ?? 0) + 1)
        : acc;
    },
    new Map() as Map<Absence, number>,
  );

  return { totalWorkMinutes, workMinutesPerDay, absenceMap };
}

export default async function Statistics() {
  const user = await getUserFromSession();
  if (!user) {
    return null;
  }
  const settings = await getSettings(user.id);
  if (!settings) {
    return null;
  }
  const beginDate = settings.begin_date;

  const { workMinutesPerDay, absenceMap, totalWorkMinutes } =
    await getWorklogData(user.id, beginDate);
  const [minTuple, maxTuple] = getDayWithMinMaxHours(workMinutesPerDay);
  const absences = Array.from(absenceMap).reduce(
    (acc, [absence, count]) => [
      ...acc,
      <span key={absence}>{absenceReasonToString(absence)}</span>,
      <span key={`${absence}-${count}`}>{count}</span>,
      //<span>{absenceReasonToString(absence)}</span>,
      //<span>{count}</span>,
    ],
    [] as JSX.Element[],
  );
  return (
    <div className="flex flex-col flex-nowrap justify-center items-center mt-3">
      <h2 className="text-xl text-center m-3 mb-0 w-64">Statistics</h2>
      <h3 className="text-sm text-center mx-3 mt-0 mb-8 w-64">
        {toDayMonthYear(beginDate)} - {toDayMonthYear(endOfDay())}
      </h3>
      <div className="grid grid-cols-2 gap-2 items-top w-80 md:w-96">
        <span>Total hours logged</span>
        <span>{minutesToSaldoObject(totalWorkMinutes).toString()}</span>

        <span>Avg hours per day</span>
        <span>
          {minutesToSaldoObject(
            totalWorkMinutes / workMinutesPerDay.size,
          ).toString()}
        </span>

        <span>Most hours per day</span>
        <span>{format(maxTuple)}</span>

        <span>Least hours per day</span>
        <span>{format(minTuple)}</span>

        <span>Absences</span>
        <span className="grid grid-cols-[6rem_auto] gap-2 items-top">
          {absences}
        </span>
      </div>
      <WorkMinutesPerDayChart workMinutesPerDay={workMinutesPerDay} />
    </div>
  );
}

function getDayWithMinMaxHours(workMinutesPerDay: Map<string, number>) {
  let min: number = -1;
  const minTuple: [Date_ISODay | null, SaldoForDay | null] = [null, null];
  let max: number = -1;
  const maxTuple: [Date_ISODay | null, SaldoForDay | null] = [null, null];

  workMinutesPerDay.forEach((value, key) => {
    if (min === -1 || value < min) {
      min = value;
      assertIsISODay(key);
      minTuple[0] = key;
      minTuple[1] = minutesToSaldoObject(value);
    }
    if (max === -1 || value > max) {
      max = value;
      assertIsISODay(key);
      maxTuple[0] = key;
      maxTuple[1] = minutesToSaldoObject(value);
    }
  });
  return [minTuple, maxTuple];
}
function format(tuple: [Date_ISODay | null, SaldoForDay | null]) {
  if (!tuple[0] || !tuple[1]) {
    return '';
  }
  return tuple[1].toString() + ' on ' + toDayMonthYear(tuple[0]);
}
