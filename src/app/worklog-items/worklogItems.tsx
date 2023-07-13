'use client';
import { Settings, Worklog } from '@prisma/client';
import WorklogItem from '../components/worklogItem/worklogItem';
import { useState } from 'react';
import { toDayMonthYear, toISODay } from '@/util/dateFormatter';
import { startOfDay } from '@/util/date';

function groupWorklogs(
  worklogs: Worklog[],
  settings: Settings,
  onWorklogDelete: (deletedWorklogId: number) => void,
  onWorklogEdit: (edited: Worklog) => void,
) {
  let day = '';

  return worklogs.reduce((acc: Record<string, JSX.Element[]>, x) => {
    const ignored = settings.begin_date.getTime() > x.from.getTime();
    const loggingDay = toISODay(x.from);

    const elem = (
      <WorklogItem
        key={x.id}
        worklog={x}
        ignored={ignored}
        onDelete={onWorklogDelete}
        onEdit={onWorklogEdit}
      />
    );

    if (day !== loggingDay) {
      acc[loggingDay] = [];
    }
    acc[loggingDay] = [...acc[loggingDay], elem];
    day = loggingDay;
    return acc;
  }, {});
}

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
  const onWorklogDelete = (deletedWorklogId: number) => {
    setWl(
      wl
        .filter((x) => x.id !== deletedWorklogId)
        .sort((a, b) => b.from.getTime() - a.from.getTime()),
    );
  };
  const onWorklogEdit = (editedWorklog: Worklog) => {
    setWl(
      wl
        .map((x) => (x.id !== editedWorklog.id ? x : editedWorklog))
        .sort((a, b) => b.from.getTime() - a.from.getTime()),
    );
  };
  const groupedWorklogs = groupWorklogs(
    wl,
    settings,
    onWorklogDelete,
    onWorklogEdit,
  );

  return (
    <div className="flex flex-col justify-center items-center mt-3">
      <h2 className="text-xl mt-3">All worklogs</h2>
      <h3 className="text-l mt-3">Current saldo: {`${saldo}`}</h3>

      <div className="flex flex-nowrap flex-col justify-center items-center m-3 sm:w-3/4">
        {Object.keys(groupedWorklogs).reduce((acc: JSX.Element[], day) => {
          const ignored =
            settings.begin_date.getTime() > startOfDay(day).getTime();
          acc.push(
            <div
              className={`badge ${
                ignored ? 'badge-base-100 text-base-300' : 'badge-neutral'
              } ${day !== '' ? 'mt-8' : ''}`}
            >
              {toDayMonthYear(day)}
            </div>,
          );
          acc.push(
            <div className="flex flex-wrap justify-center">
              {groupedWorklogs[day]}
            </div>,
          );
          return acc;
        }, [])}
        {/*wl.reduce((acc: Record<string, Worklog[]>, x) => {
          const ignored = settings.begin_date.getTime() > x.from.getTime();
          const loggingDay = toDayMonthYear(x.from);

          if (day !== loggingDay) {
            acc[loggingDay] = [];
          }
          return [...acc[loggingDay], x];
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
        }, [])*/}
      </div>
    </div>
  );
}
