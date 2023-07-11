'use client';
import { Worklog } from '@prisma/client';
import WorklogItem from '../components/worklogItem/worklogItem';
import { useState } from 'react';
import { toDayMonthYear } from '@/util/dateFormatter';

export default function WorklogItems({ worklogs }: { worklogs: Worklog[] }) {
  const [wl, setWl] = useState(worklogs);
  let day = '';
  return (
    <div className="flex flex-col justify-center items-center mt-3">
      <h2 className="text-xl text-center sm:text-right mt-3">All worklogs</h2>

      <div className="flex flex-wrap justify-center items-center m-3 w-80">
        {wl.reduce((acc: JSX.Element[], x) => {
          const loggingDay = toDayMonthYear(x.from);
          if (day !== loggingDay) {
            acc.push(
              <div
                className={`badge badge-neutral ${day !== '' ? 'mt-8' : ''}`}
              >
                {loggingDay}
              </div>,
            );
            day = loggingDay;
          }
          acc.push(
            <WorklogItem
              key={x.id}
              worklog={x}
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
            />,
          );
          return acc;
        }, [])}
      </div>
    </div>
  );
}
