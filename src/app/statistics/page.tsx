import { getUserFromSession } from '@/auth/authSession';
import { getWorklogs } from '@/repository/worklogRepository';
import { minutesToSaldoObject, worklogMinutes } from '@/services';
import { AbsenceReason, SaldoForDay } from '@/types';
import { assertIsISODay } from '@/util/assertionFunctions';
import { Date_ISODay, toDayMonthYear, toISODay } from '@/util/dateFormatter';

export default async function Statistics() {
  const user = await getUserFromSession();
  if (!user) {
    return null;
  }
  const worklogs = await getWorklogs(user.id);
  const workDayWorklogs = worklogs.filter((x) => !x.absence);
  const totalWorklogs = workDayWorklogs.reduce((acc, x) => {
    return acc + worklogMinutes(x);
  }, 0);
  const workMinutesPerDay = workDayWorklogs.reduce(
    (acc, x) => {
      const day = toISODay(x.from);
      return acc.set(day, (acc.get(day) || 0) + worklogMinutes(x));
    },
    new Map() as Map<string, number>,
  );

  const [minTuple, maxTuple] = getDayWithMinMaxHours(workMinutesPerDay);
  return (
    <div className="flex flex-col flex-nowrap justify-center items-center mt-3">
      <h2 className="text-xl text-center m-3 mb-8 w-64">Statistics</h2>
      <div className="grid grid-cols-2 gap-2 items-center w-80">
        <span>Total hours logged</span>
        <span>{minutesToSaldoObject(totalWorklogs).toString()}</span>

        <span>Avg hours per day</span>
        <span>
          {minutesToSaldoObject(
            totalWorklogs / workMinutesPerDay.size,
          ).toString()}
        </span>

        <span>Most hours per day</span>
        <span>{format(maxTuple)}</span>

        <span>Least hours per day</span>
        <span>{format(minTuple)}</span>

        <span>Flex days</span>
        <span>
          {
            worklogs.filter((x) => x.absence === AbsenceReason.flex_hours)
              .length
          }
        </span>
      </div>
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
