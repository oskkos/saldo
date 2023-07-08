import { Worklog } from '@prisma/client';
import ExistingWorklog from './existingWorklog';
import { diffInHours } from '@/util/date';

function countSum(worklogs: Worklog[]) {
  return worklogs.reduce((sum, worklog) => {
    return sum + diffInHours(worklog.to, worklog.from);
  }, 0);
}

export default function ExistingWorklogs({
  worklogs,
}: {
  worklogs: Worklog[];
}) {
  return worklogs.length ? (
    <>
      <h2 className="text-xl text-center sm:text-right  m-3 w-64">
        Worklogs for day ({countSum(worklogs)} h)
      </h2>
      <div className="flex flex-wrap justify-between items-center m-3 w-80">
        {worklogs.map((x) => (
          <ExistingWorklog key={x.id} worklog={x} />
        ))}
      </div>
    </>
  ) : null;
}
