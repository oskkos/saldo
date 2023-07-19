import { getWorklogs } from '@/repository/worklogRepository';
import WorklogForm from './worklogForm';
import { onWorklogSubmit } from '@/actions';
import { endOfDay, startOfDay } from '@/util/date';
import { getUserFromSession } from '@/auth/authSession';

export default async function WorklogEntry({
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
    <WorklogForm
      key={searchParams.day}
      day={searchParams.day}
      worklogs={worklogs}
      onSubmit={onWorklogSubmit.bind(null, user.id)}
    />
  );
}
