'use client';
import { useState } from 'react';
import WorklogInputs from './worklogInputs';
import { WorklogFormData } from '@/types';
import { Worklog } from '@prisma/client';
import { toTime } from '@/util/dateFormatter';

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
  onEdit: (worklogId: number, data: WorklogFormData) => void;
}) {
  const [value, setValue] = useState({
    from: toTime(worklog.from),
    to: toTime(worklog.to),
    comment: (worklog.comment ?? '') as unknown as string,
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
              onEdit(worklog.id, value);
            }}
          >
            Edit
          </button>
        </div>
      </form>
    </dialog>
  );
}
