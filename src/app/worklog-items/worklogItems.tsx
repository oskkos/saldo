'use client';
import { Settings, Worklog } from '@prisma/client';
import WorklogItem from '../components/worklogItem/worklogItem';
import { useState } from 'react';
import { toDayMonthYear } from '@/util/dateFormatter';

export default function WorklogItems({
  worklogs,
  settings,
  saldo,
}: {
  worklogs: Worklog[];
  settings: Settings;
  saldo: string;
}) {
  const [wl, setWl] = useState(worklogs);
  let day = '';
  console.log(saldo);
  return (
    <div className="flex flex-col justify-center items-center mt-3">
      <h2 className="text-xl text-center sm:text-right mt-3">All worklogs</h2>
      <h3 className="text-l text-center sm:text-right mt-3">
        Current saldo: {`${saldo}`}
      </h3>

      <div className="flex flex-wrap justify-center items-center m-3 w-80">
        {wl.reduce((acc: JSX.Element[], x) => {
          const ignored = settings.begin_date.getTime() > x.from.getTime();
          const loggingDay = toDayMonthYear(x.from);
          if (day !== loggingDay) {
            acc.push(
              <div
                className={`badge ${
                  ignored ? 'badge-base-100 text-base-300' : 'badge-neutral'
                } ${day !== '' ? 'mt-8' : ''}`}
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
              ignored={ignored}
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
