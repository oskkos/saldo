import ExistingWorklogs from './existingWorklogs';
import { getSession } from '../api/auth/[...nextauth]/route';
import { getWorklogs } from '@/repository/worklogRepository';
import { getUser } from '@/repository/userRepository';
import WorklogForm from './worklogForm';
import { onWorklogSubmit } from '@/actions';
import { endOfDay, startOfDay, toDate } from '@/util/date';

export default async function WorklogEntry({
  searchParams,
}: {
  searchParams: { day: string };
}) {
  const session = await getSession();
  const user = await getUser(session.user?.email ?? '');
  const date = toDate(searchParams.day);
  const worklogs = await getWorklogs(user.id, startOfDay(date), endOfDay(date));
  return (
    <>
      <div className="flex flex-wrap justify-center items-top mt-3">
        <WorklogForm
          day={searchParams.day}
          onSubmit={onWorklogSubmit.bind(null, user.id)}
        />
      </div>
      <div className="flex flex-wrap justify-center items-top mt-3">
        <ExistingWorklogs worklogs={worklogs} />
      </div>
    </>
  );
}
