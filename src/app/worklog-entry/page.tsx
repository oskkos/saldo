import dayjs from 'dayjs';
import ExistingWorklogs from './existingWorklogs';
import { getSession } from '../api/auth/[...nextauth]/route';
import { getWorklogs } from '@/repository/worklogRepository';
import { getUser } from '@/repository/userRepository';

export default async function WorklogEntry({
  searchParams,
}: {
  searchParams: { day: string };
}) {
  const session = await getSession();
  const user = await getUser(session.user?.email ?? '');
  const date = dayjs(searchParams.day);
  const worklogs = await getWorklogs(
    user.id,
    date.startOf('day').toDate(),
    date.endOf('day').toDate(),
  );
  return (
    <div>
      <h2 className="col-span-5 flex justify-center items-center text-xl">
        Worklog for {date.format('D.M.YYYY')}
      </h2>
      <input type="time" /> - <input type="time" />
      <ExistingWorklogs worklogs={worklogs} />
    </div>
  );
}
