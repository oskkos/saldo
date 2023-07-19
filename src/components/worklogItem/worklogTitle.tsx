'use client';

import { toTime } from '@/util/dateFormatter';
import { Worklog } from '@prisma/client';
import AbsenceIcon from '@/components/worklogItem/absenceIcon';
import { MdRestaurant } from 'react-icons/md';
import { absenceReasonToString } from '@/services';
import { assertIsAbsenceReason } from '@/util/assertionFunctions';

export default function WorklogTitle({ worklog }: { worklog: Worklog }) {
  if (worklog.absence) {
    assertIsAbsenceReason(worklog.absence);
  }
  return (
    <div className="flex flex-wrap">
      <h2 className="card-title mr-2">
        {worklog.absence
          ? absenceReasonToString(worklog.absence)
          : `${toTime(worklog.from)} - ${toTime(worklog.to)}`}
      </h2>
      {worklog.absence ? (
        <AbsenceIcon absence={worklog.absence} className="w-6 h-6" />
      ) : worklog.subtract_lunch_break ? (
        <MdRestaurant className="w-6 h-6" />
      ) : null}
    </div>
  );
}
