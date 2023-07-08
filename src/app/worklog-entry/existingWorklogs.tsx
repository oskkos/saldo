import { Worklog } from '@prisma/client';
import ExistingWorklog from './existingWorklog';

export default function ExistingWorklogs({
  worklogs,
}: {
  worklogs: Worklog[];
}) {
  return worklogs.length ? (
    <>
      <h2 className="text-xl text-center sm:text-right  m-3 w-64">
        Existing worklogs for day
      </h2>
      <div className="flex flex-wrap justify-between items-center m-3 w-80">
        {worklogs.map((x) => (
          <ExistingWorklog key={x.id} worklog={x} />
        ))}
      </div>
    </>
  ) : null;
}
