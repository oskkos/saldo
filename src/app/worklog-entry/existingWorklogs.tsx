import { Worklog } from '@prisma/client';
import WorklogItem from '../components/worklogItem/worklogItem';
import { calulateWorklogsSum } from '@/services';

export default function ExistingWorklogs({
  worklogs,
  onDelete,
  onEdit,
}: {
  worklogs: Worklog[];
  onDelete: (id: number) => void;
  onEdit: (editedWorklog: Worklog) => void;
}) {
  return worklogs.length ? (
    <>
      <div className="indicator justify-center w-80">
        <span className="indicator-item indicator-bottom indicator-center badge badge-accent">
          {calulateWorklogsSum(worklogs).toString()}
        </span>

        <h2 className="text-xl text-center sm:text-right m-3 w-64">
          Existing worklogs for day
        </h2>
      </div>
      <div className="flex flex-wrap justify-between items-center m-3 w-80">
        {worklogs.map((x) => (
          <WorklogItem
            key={x.id}
            worklog={x}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </div>
    </>
  ) : null;
}
