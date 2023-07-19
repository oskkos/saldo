'use client';
import { useState, useTransition } from 'react';
import WorklogInputs from '../worklogInputs';
import { Worklog } from '@prisma/client';
import { toISODay, toTime } from '@/util/dateFormatter';
import { useRouter } from 'next/navigation';
import { onWorklogEdit } from '@/actions';
import { toDate } from '@/util/date';
import { WorklogFormDataEntry } from '@/types';

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
  const [value, setValue] = useState<WorklogFormDataEntry>({
    day: toISODay(worklog.from),
    from: toTime(worklog.from),
    to: toTime(worklog.to),
    comment: worklog.comment ?? '',
    subtractLunchBreak: worklog.subtract_lunch_break,
  });
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
              if (!value.day) {
                throw new Error('Day is missing');
              }
              const ret = {
                ...value,
                from: toDate(`${value.day} ${value.from}`),
                to: toDate(`${value.day} ${value.to}`),
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
