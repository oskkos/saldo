'use client';
import { useState, useTransition } from 'react';
import { Worklog } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { toDate } from '@/util/date';
import WorklogInputs from './worklogInputs';
import { WorklogFormData } from '@/types';
import { toISODay } from '@/util/dateFormatter';
import { onWorklogSubmit } from '@/actions';
import {
  NEW_WORKLOG_DEFAULT_FROM,
  NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH,
  NEW_WORKLOG_DEFAULT_TO,
} from '@/constants';

const toString = (day: string, time: string) => {
  return day && time ? toDate(`${day} ${time}`).toISOString() : '';
};

export function showQuickAddWorklogModal(modalId: string) {
  (
    window[modalId as unknown as number] as unknown as { showModal(): void }
  ).showModal();
}
export default function QuickAddWorklogModal({
  userId,
  modalId,
  onSubmit,
}: {
  userId: number;
  modalId: string;
  onSubmit: (worklog: Worklog) => void;
}) {
  const [, setTransition] = useTransition();
  const router = useRouter();
  const [value, setValue] = useState<WorklogFormData & { day?: string }>({
    day: toISODay(new Date()),
    comment: '',
    from: NEW_WORKLOG_DEFAULT_FROM,
    to: NEW_WORKLOG_DEFAULT_TO,
    subtractLunchBreak: NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH,
  });
  return (
    <dialog id={modalId} className="modal modal-bottom sm:modal-middle">
      <form method="dialog" className="modal-box">
        <h3 className="font-bold text-lg">Add new worklog</h3>

        <div className="flex flex-wrap justify-between items-center m-3">
          <input
            type="date"
            placeholder="Date"
            className="input input-bordered w-full mb-3"
            value={value.day}
            onChange={(e) => {
              setValue({ ...value, day: e.target.value });
            }}
          />
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
                from: toString(value.day, value.from),
                to: toString(value.day, value.to),
              };
              setTransition(() => {
                onWorklogSubmit(userId, ret)
                  .then((worklog) => {
                    onSubmit(worklog);
                    router.refresh(); // https://github.com/vercel/next.js/issues/52350
                  })
                  .catch(() => {
                    throw new Error('Failed to add worklog');
                  });
              });
            }}
          >
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
