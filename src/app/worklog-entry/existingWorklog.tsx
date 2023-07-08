import { Worklog } from '@prisma/client';
import { MdDelete, MdModeEdit } from 'react-icons/md';
import WorklogTitle from './worklogTitle';

export default function ExistingWorklog({ worklog }: { worklog: Worklog }) {
  return (
    <div className="card w-full bg-base-200 shadow-xl mb-4">
      <div className="card-body">
        <div className="flex justify-between">
          <WorklogTitle worklog={worklog} />
          <div className="card-actions justify-end w-16">
            <MdModeEdit />
            <MdDelete />
          </div>
        </div>
        {worklog.comment ? <p>{worklog.comment}</p> : null}
      </div>
    </div>
  );
}
