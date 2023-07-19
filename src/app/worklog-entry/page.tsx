import { getWorklogs } from '@/repository/worklogRepository';
import WorklogEntry from './worklogEntry';
import { onWorklogSubmit } from '@/actions';
import { endOfDay, startOfDay } from '@/util/date';
import { getUserFromSession } from '@/auth/authSession';

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
      key={searchParams.day}
      day={searchParams.day}
      worklogs={worklogs}
      onSubmit={onWorklogSubmit.bind(null, user.id)}
    />
  );
}
