'use client';
import { WorklogFormData } from '@/types';
import { toDate } from '@/util/date';
import { toDayMonthYear } from '@/util/dateFormatter';
import { useState } from 'react';

const toString = (day: string, time: string) => {
  return day && time ? toDate(`${day} ${time}`).toISOString() : '';
};
export default function WorklogForm({
  day,
  onSubmit,
}: {
  day: string;
  onSubmit: (value: WorklogFormData) => Promise<void>;
}) {
  const [value, setValue] = useState({
    from: '08:00',
    to: '16:00',
    comment: '',
  });
  return (
    <>
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
            void onSubmit(ret);
          }}
        >
          Submit
        </button>
      </div>
    </>
  );
}
