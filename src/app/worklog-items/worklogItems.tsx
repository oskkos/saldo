'use client';
import { Settings, Worklog } from '@prisma/client';
import WorklogItem from '../components/worklogItem/worklogItem';
import { useState } from 'react';
import { toDayMonthYear, toISODay } from '@/util/dateFormatter';
import { startOfDay } from '@/util/date';

function groupWorklogs(worklogs: Worklog[]) {
  return worklogs.reduce((acc: Record<string, Worklog[]>, x) => {
    const loggingDay = toISODay(x.from);

    if (!(acc[loggingDay] instanceof Array)) {
      acc[loggingDay] = [];
    }
    acc[loggingDay] = [...acc[loggingDay], x];
    return acc;
  }, {});
}
function worklogsToElements(
  worklogs: Worklog[],
  beginDate: Date,
  onWorklogDelete: (deletedWorklogId: number) => void,
  onWorklogEdit: (edited: Worklog) => void,
) {
  return worklogs.map((x) => {
    const ignored = beginDate.getTime() > x.from.getTime();
    return (
      <WorklogItem
        key={x.id}
        worklog={x}
        ignored={ignored}
        onDelete={onWorklogDelete}
        onEdit={onWorklogEdit}
      />
    );
  });
}
function dayBadge(day: string, beginDate: Date) {
  const ignored = beginDate.getTime() > startOfDay(day).getTime();
  return (
    <div
      key={`${day}-badge`}
      className={`badge ${
        ignored ? 'badge-base-100 text-base-300' : 'badge-neutral'
      } ${day !== '' ? 'mt-8' : ''}`}
    >
      {toDayMonthYear(day)}
    </div>
  );
}

export default function WorklogItems({
  worklogs,
  settings,
  saldo,
}: {
  worklogs: Worklog[];
  settings: Settings;
  saldo: JSX.Element;
}) {
  const [wl, setWl] = useState<Worklog[]>(worklogs);

  if (worklogs.length !== wl.length) {
    // Don't really understand why this is required but without this
    // new worklog added with QuickAdd modal isn't shown without refresh
    setWl(worklogs);
  }

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
  const groupedWorklogs = groupWorklogs(wl);

  return (
    <div className="flex flex-col justify-center items-center mt-3">
      <h2 className="text-xl mt-3">All worklogs</h2>
      <h3 className="text-l mt-3">Current saldo: {saldo}</h3>

      <div className="flex flex-nowrap flex-col justify-center items-center m-3 sm:w-3/4">
        {Object.keys(groupedWorklogs).reduce((acc: JSX.Element[], day) => {
          acc.push(dayBadge(day, settings.begin_date));
          acc.push(
            <div key={`${day}-items`} className="flex flex-wrap justify-center">
              {worklogsToElements(
                groupedWorklogs[day],
                settings.begin_date,
                onWorklogDelete,
                onWorklogEdit,
              )}
            </div>,
          );
          return acc;
        }, [])}
      </div>
    </div>
  );
}
