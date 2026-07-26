import WorklogItem from '@/components/worklogItem/worklogItem';
import { calculateWorklogsSum } from '@/services';
import { Worklog } from '@/types';

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
        {/* Hours the user logged, so an absence is left out: it is stored as a
            full-day worklog and would add work nobody did. The mini-calendar's
            border colour asks a different question — did the day meet its
            obligation — and still counts the absence. */}
        {calculateWorklogsSum(
          worklogs.filter((worklog) => !worklog.absence),
        ).toBadge()}
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
