import { getWorklogs } from '@/repository/worklogRepository';
import WorklogEntry from './worklogEntry';
import { onWorklogSubmit } from '@/actions';
import { endOfDay, startOfDay } from '@/util/date';
import { getUserFromSession } from '@/auth/authSession';
import { Date_ISODay } from '@/util/dateFormatter';

export default async function WorklogEntryPage({
  searchParams,
}: {
  searchParams: { day: string };
}) {
  const user = await getUserFromSession();
  const worklogs = await getWorklogs(
    user.id,
    startOfDay(searchParams.day),
    endOfDay(searchParams.day),
  );
  return (
    <WorklogEntry
      key={searchParams.day as Date_ISODay}
      day={searchParams.day as Date_ISODay}
      worklogs={worklogs}
      onSubmit={onWorklogSubmit.bind(null, user.id)}
    />
  );
}
