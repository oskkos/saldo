'use client';
import { Settings, Worklog } from '@prisma/client';
import WorklogItem from '../components/worklogItem/worklogItem';
import { useState } from 'react';
import {
  toDayMonthYear,
  toISODay,
  toMonthAndYear,
  toYearAndMonth,
} from '@/util/dateFormatter';
import { diffInMinutes, startOfDay } from '@/util/date';
import { sortWorklogs } from '@/services';

function groupWorklogsByDay(worklogs: Worklog[]) {
  return worklogs.reduce((acc: Record<string, Worklog[] | undefined>, x) => {
    const loggingDay = toISODay(x.from);
    acc[loggingDay] = [...(acc[loggingDay] ?? []), x];
    return acc;
  }, {});
}
function groupWorklogsByMonth(
  groupedWorklogsByDay: Record<string, Worklog[] | undefined>,
) {
  return Object.keys(groupedWorklogsByDay).reduce(
    (
      acc: Record<string, Record<string, Worklog[] | undefined> | undefined>,
      day,
    ) => {
      let group: string;
      if (diffInMinutes(startOfDay(day), startOfDay(new Date())) <= 0) {
        group = toYearAndMonth(day);
      } else {
        group = 'future';
      }
      return {
        ...acc,
        [group]: {
          ...(acc[group] ?? {}),
          [day]: [
            ...(acc[group]?.[day] ?? []),
            ...(groupedWorklogsByDay[day] ?? []),
          ],
        },
      };
    },
    {},
  );
}
function worklogsOfDayToElements(
  day: string,
  worklogs: Worklog[],
  beginDate: Date,
  onWorklogDelete: (deletedWorklogId: number) => void,
  onWorklogEdit: (edited: Worklog) => void,
) {
  const ignored = beginDate.getTime() > startOfDay(day).getTime();
  return (
    <div key={`${day}-wrapper`}>
      <div
        className={`mt-4 badge ${
          ignored ? 'badge-base-100 text-base-300' : 'badge-neutral'
        }`}
      >
        {toDayMonthYear(day)}
      </div>

      <div className="flex flex-wrap justify-center">
        {worklogs.map((x) => {
          return (
            <WorklogItem
              key={x.id}
              worklog={x}
              ignored={ignored}
              onDelete={onWorklogDelete}
              onEdit={onWorklogEdit}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function WorklogItems({
  worklogs,
  settings,
}: {
  worklogs: Worklog[];
  settings: Settings;
}) {
  const [wl, setWl] = useState<Worklog[]>(worklogs);

  if (worklogs.length !== wl.length) {
    // Don't really understand why this is required but without this
    // new worklog added with QuickAdd modal isn't shown without refresh
    setWl(worklogs);
  }

  const onWorklogDelete = (deletedWorklogId: number) => {
    setWl(sortWorklogs(wl.filter((x) => x.id !== deletedWorklogId)));
  };
  const onWorklogEdit = (edited: Worklog) => {
    setWl(sortWorklogs(wl.map((x) => (x.id !== edited.id ? x : edited))));
  };
  const groupedWorklogsByDay = groupWorklogsByDay(wl);
  const groupedWorklogsByMonth = groupWorklogsByMonth(groupedWorklogsByDay);

  return (
    <div className="join join-vertical flex justify-center items-center mt-4">
      {Object.keys(groupedWorklogsByMonth)
        .sort()
        .reverse()
        .map((k) => (
          <div
            key={k}
            className="join-item collapse collapse-arrow border border-base-300 w-11/12 sm:w-3/4"
          >
            <input type="checkbox" />
            <div className="collapse-title text-xl font-medium">
              {k === 'future' ? 'Future worklogs' : toMonthAndYear(k)}
            </div>
            <div className="collapse-content flex flex-nowrap flex-col justify-center items-center">
              {Object.keys(groupedWorklogsByMonth[k] ?? {}).map((day) =>
                worklogsOfDayToElements(
                  day,
                  groupedWorklogsByMonth[k]?.[day] ?? [],
                  settings.begin_date,
                  onWorklogDelete,
                  onWorklogEdit,
                ),
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
