'use client';
import { useState, useTransition } from 'react';
import WorklogInputs from '../worklogInputs';
import { Worklog } from '@prisma/client';
import { toTime } from '@/util/dateFormatter';
import { useRouter } from 'next/navigation';
import { onWorklogEdit } from '@/actions';
import { toDate } from '@/util/date';

const toString = (day: string, time: string) => {
  return day && time ? toDate(`${day} ${time}`).toISOString() : '';
};

export function showWorklogEditModal(editModalId: string) {
  (
    window[editModalId as unknown as number] as unknown as { showModal(): void }
  ).showModal();
}
export default function WorklogEditModal({
  worklog,
  editModalId,
  onEdit,
}: {
  worklog: Worklog;
  editModalId: string;
  onEdit: (editedWorklog: Worklog) => void;
}) {
  const [, setTransition] = useTransition();
  const router = useRouter();
  const [value, setValue] = useState({
    from: toTime(worklog.from),
    to: toTime(worklog.to),
    comment: (worklog.comment ?? '') as unknown as string,
    subtractLunchBreak: true,
  });
  const day = worklog.from.toISOString().split('T')[0];
  return (
    <dialog id={editModalId} className="modal modal-bottom sm:modal-middle">
      <form method="dialog" className="modal-box">
        <h3 className="font-bold text-lg">Edit worklog</h3>
        <div className="flex flex-wrap justify-between items-center m-3 sm:w-11/12">
          <WorklogInputs value={value} setValue={setValue} />
        </div>
        <div className="modal-action">
          <button className="btn">Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => {
              const ret = {
                ...value,
                from: toString(day, value.from),
                to: toString(day, value.to),
              };
              setTransition(() => {
                onWorklogEdit(worklog.id, ret)
                  .then((editedWorklog) => {
                    onEdit(editedWorklog);
                    router.refresh(); // https://github.com/vercel/next.js/issues/52350
                  })
                  .catch(() => {
                    throw new Error('Failed to edit worklog');
                  });
              });
            }}
          >
            Edit
          </button>
        </div>
      </form>
    </dialog>
  );
}
