'use client';
import { WorklogFormData } from '@/types';
import { add, subtract, toDate } from '@/util/date';
import { toDayMonthYear, toISODay } from '@/util/dateFormatter';
import { useState, useTransition } from 'react';
import ExistingWorklogs from './existingWorklogs';
import { Worklog } from '@prisma/client';
import WorklogInputs from '../components/worklogInputs';
import { useRouter } from 'next/navigation';
import { MdArrowBack, MdArrowForward } from 'react-icons/md';

const toString = (day: string, time: string) => {
  return day && time ? toDate(`${day} ${time}`).toISOString() : '';
};
export default function WorklogForm({
  day,
  worklogs,
  onSubmit,
}: {
  day: string;
  worklogs: Worklog[];
  onSubmit: (value: WorklogFormData) => Promise<Worklog[]>;
}) {
  const [value, setValue] = useState({
    from: '08:00',
    to: '16:00',
    comment: '',
  });
  const [wl, setWl] = useState(worklogs);
  const [, setTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      <div className="flex flex-wrap justify-center items-start mt-3">
        <div className="flex justify-between items-center w-80">
          <div>
            {/* Should probably use Link, but data doesn't get reloaded*/}
            <a href={`/worklog-entry?day=${toISODay(subtract(day, 1, 'day'))}`}>
              <MdArrowBack
                className="w-6 h-6 cursor-pointer"
                title="Yesterday"
              />
            </a>
          </div>

          <h2 className="text-xl text-center m-3 w-64">
            {toDayMonthYear(day)}
          </h2>
          <div>
            {/* Should probably use Link, but data doesn't get reloaded*/}
            <a href={`/worklog-entry?day=${toISODay(add(day, 1, 'day'))}`}>
              <MdArrowForward
                className="w-6 h-6 cursor-pointer"
                title="Tomorrow"
              />
            </a>
          </div>
        </div>
        <div className="flex flex-wrap justify-between items-center m-3 w-80">
          <WorklogInputs value={value} setValue={setValue} />
          <button
            className="btn btn-secondary mt-3 w-full"
            onClick={() => {
              const ret = {
                ...value,
                from: toString(day, value.from),
                to: toString(day, value.to),
              };
              setTransition(() => {
                onSubmit(ret)
                  .then((x) => {
                    setWl(x);
                    router.refresh(); // https://github.com/vercel/next.js/issues/52350
                  })
                  .catch(() => {
                    throw new Error('Failed to add worklog');
                  });
              });
            }}
          >
            Submit
          </button>
        </div>
      </div>
      <div className="flex flex-wrap justify-center items-center mt-3">
        <ExistingWorklogs
          worklogs={wl}
          onDelete={(deletedWorklogId: number) => {
            setWl(
              wl
                .filter((x) => x.id !== deletedWorklogId)
                .sort((a, b) => b.from.getTime() - a.from.getTime()),
            );
          }}
          onEdit={(editedWorklog: Worklog) => {
            setWl(
              wl
                .map((x) => (x.id !== editedWorklog.id ? x : editedWorklog))
                .sort((a, b) => b.from.getTime() - a.from.getTime()),
            );
          }}
        />
      </div>
    </>
  );
}
