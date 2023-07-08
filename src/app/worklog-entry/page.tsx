import dayjs from 'dayjs';
import ExistingWorklogs from './existingWorklogs';
import { getSession } from '../api/auth/[...nextauth]/route';
import { getWorklogs, insertWorklog } from '@/repository/worklogRepository';
import { getUser } from '@/repository/userRepository';
import WorklogForm from './worklogForm';
import { WorklogFormData } from '@/types';

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
  const onSubmit = async (data: WorklogFormData) => {
    'use server';

    await insertWorklog(user.id, data);
    console.log(data);
  };
  return (
    <>
      <div className="flex flex-wrap justify-center items-top mt-3">
        <WorklogForm day={searchParams.day} onSubmit={onSubmit} />
      </div>
      <div className="flex flex-wrap justify-center items-top mt-3">
        <ExistingWorklogs worklogs={worklogs} />
      </div>
    </>
  );
}
