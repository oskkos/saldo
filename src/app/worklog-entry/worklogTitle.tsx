'use client';

import { toTime } from '@/util/dateFormatter';
import { Worklog } from '@prisma/client';

export default function WorklogTitle({ worklog }: { worklog: Worklog }) {
  return (
    <h2 className="card-title">
      {toTime(worklog.from)} - {toTime(worklog.to)}
    </h2>
  );
}
