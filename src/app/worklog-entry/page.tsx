import { getWorklogs } from '@/repository/worklogRepository';
import WorklogEntry from './worklogEntry';
import { onWorklogSubmit } from '@/actions';
import { endOfDay, startOfDay } from '@/util/date';
import { getSession, getUserFromSession } from '@/auth/authSession';
import { assertIsISODay } from '@/util/assertionFunctions';

export default async function WorklogEntryPage({
  searchParams,
}: {
  searchParams: { day: string };
}) {
  const session = await getSession();
  if (!session) {
    return null;
  }
  const user = await getUserFromSession();
  if (!user) {
    return null;
  }
  const worklogs = await getWorklogs(
    user.id,
    startOfDay(searchParams.day),
    endOfDay(searchParams.day),
  );
  assertIsISODay(searchParams.day);
  return (
    <WorklogEntry
      key={searchParams.day}
      day={searchParams.day}
      worklogs={worklogs}
      onSubmit={onWorklogSubmit.bind(null, user.id)}
    />
  );
}
