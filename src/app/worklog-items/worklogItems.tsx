'use client';
import { Worklog } from '@prisma/client';
import WorklogItem from '../components/worklogItem/worklogItem';
import { useState } from 'react';

export default function WorklogItems({ worklogs }: { worklogs: Worklog[] }) {
  const [wl, setWl] = useState(worklogs);

  return (
    <div className="flex flex-wrap justify-center items-start mt-3">
      <h2 className="text-xl text-center sm:text-right m-3 w-64">
        All the worklogs
      </h2>

      <div className="flex flex-wrap justify-between items-center m-3 w-80">
        {wl.map((x) => {
          return (
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
            />
          );
        })}
      </div>
    </div>
  );
}
