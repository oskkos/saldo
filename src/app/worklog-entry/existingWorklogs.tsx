import { Worklog } from '@prisma/client';
import ExistingWorklog from './existingWorklog';
import { diffInMinutes } from '@/util/date';

function countSum(worklogs: Worklog[]) {
  const total = worklogs.reduce((sum, worklog) => {
    return sum + diffInMinutes(worklog.to, worklog.from);
  }, 0);
  const hours = Math.floor(total / 60);
  const minutes = Math.floor(total % 60);
  return (hours ? `${hours} h ` : '') + (minutes ? `${minutes} min` : '');
}

export default function ExistingWorklogs({
  worklogs,
}: {
  worklogs: Worklog[];
}) {
  return worklogs.length ? (
    <>
      <div className="indicator items-start">
        <span className="indicator-item indicator-bottom indicator-center badge badge-accent">
          {countSum(worklogs)}
        </span>

        <h2 className="text-xl text-center sm:text-right m-3 w-64">
          Existing worklogs for day
        </h2>
      </div>
      <div className="flex flex-wrap justify-between items-center m-3 w-80">
        {worklogs.map((x) => (
          <ExistingWorklog key={x.id} worklog={x} />
        ))}
      </div>
    </>
  ) : null;
}
