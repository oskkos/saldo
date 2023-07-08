import { Worklog } from '@prisma/client';
import dayjs from 'dayjs';
import { MdDelete, MdModeEdit } from 'react-icons/md';

export default function ExistingWorklog({ worklog }: { worklog: Worklog }) {
  return (
    <div className="card w-full bg-base-200 shadow-xl mb-4">
      <div className="card-body">
        <div className="flex justify-between">
          <h2 className="card-title">
            {dayjs(worklog.from).format('HH:mm')} -{' '}
            {dayjs(worklog.to).format('HH:mm')}
          </h2>
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
