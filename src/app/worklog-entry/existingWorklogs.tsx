import { Worklog } from '@prisma/client';
import WorklogItem from '@/components/worklogItem/worklogItem';
import { calculateWorklogsSum } from '@/services';

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
      <div className="flex flex-col justify-center items-center w-80">
        <h2 className="text-xl text-center sm:text-right m-3 w-64">
          Existing worklogs for day
        </h2>
        {calculateWorklogsSum(worklogs).toBadge()}
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
