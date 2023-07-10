import { getSession } from '../api/auth/[...nextauth]/route';
import { getWorklogs } from '@/repository/worklogRepository';
import { getUser } from '@/repository/userRepository';
import WorklogForm from './worklogForm';
import { onWorklogSubmit, onWorklogDelete, onWorklogEdit } from '@/actions';
import { endOfDay, startOfDay } from '@/util/date';

export default async function WorklogEntry({
  searchParams,
}: {
  searchParams: { day: string };
}) {
  const session = await getSession();
  if (!session) {
    throw new Error('No session!');
  }
  const user = await getUser(session.user?.email ?? '');
  const worklogs = await getWorklogs(
    user.id,
    startOfDay(searchParams.day),
    endOfDay(searchParams.day),
  );
  return (
    <WorklogForm
      day={searchParams.day}
      worklogs={worklogs}
      onSubmit={onWorklogSubmit.bind(null, user.id)}
      onDelete={onWorklogDelete}
      onEdit={onWorklogEdit}
    />
  );
}
