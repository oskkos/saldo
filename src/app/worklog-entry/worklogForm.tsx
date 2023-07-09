'use client';
import { WorklogFormData } from '@/types';
import { toDate } from '@/util/date';
import { toDayMonthYear } from '@/util/dateFormatter';
import { useState } from 'react';
import ExistingWorklogs from './existingWorklogs';
import { Worklog } from '@prisma/client';

const toString = (day: string, time: string) => {
  return day && time ? toDate(`${day} ${time}`).toISOString() : '';
};
export default function WorklogForm({
  day,
  worklogs,
  onSubmit,
  onDelete,
}: {
  day: string;
  worklogs: Worklog[];
  onSubmit: (value: WorklogFormData) => Promise<Worklog[]>;
  onDelete: (deletedWorklogId: number) => Promise<void>;
}) {
  const [value, setValue] = useState({
    from: '08:00',
    to: '16:00',
    comment: '',
  });
  const [wl, setWl] = useState(worklogs);

  return (
    <>
      <div className="flex flex-wrap justify-center items-start mt-3">
        <h2 className="text-xl text-center sm:text-right m-3 w-64">
          Worklog for {toDayMonthYear(day)}
        </h2>

        <div className="flex flex-wrap justify-between items-center m-3 w-80">
          <input
            type="time"
            placeholder="From"
            value={value.from}
            className="input input-bordered w-[45%]"
            onChange={(e) => setValue({ ...value, from: e.target.value })}
          />
          -
          <input
            type="time"
            placeholder="To"
            value={value.to}
            className="input input-bordered w-[45%]"
            onChange={(e) => setValue({ ...value, to: e.target.value })}
          />
          <textarea
            className="textarea textarea-bordered mt-3 w-full"
            placeholder="Comment"
            value={value.comment}
            onChange={(e) => setValue({ ...value, comment: e.target.value })}
          ></textarea>
          <button
            className="btn btn-secondary mt-3 w-full"
            onClick={() => {
              const ret = {
                ...value,
                from: toString(day, value.from),
                to: toString(day, value.to),
              };
              onSubmit(ret)
                .then((wls) => {
                  setWl(wls);
                })
                .catch(() => {
                  /* TODO */
                });
            }}
          >
            Submit
          </button>
        </div>
      </div>
      <div className="flex flex-wrap justify-center items-start mt-3">
        <ExistingWorklogs
          worklogs={wl}
          onDelete={(deletedWorklogId: number) => {
            onDelete(deletedWorklogId)
              .then(() => {
                setWl(wl.filter((x) => x.id !== deletedWorklogId));
              })
              .catch(() => {
                throw new Error('Failed to delete worklog');
              });
          }}
        />
      </div>
    </>
  );
}
