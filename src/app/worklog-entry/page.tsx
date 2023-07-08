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
    <div className="flex flex-wrap justify-center mt-3">
      <h2 className="col-span-5 flex justify-center items-center text-xl">
        Worklog for {date.format('D.M.YYYY')}
      </h2>
      <div className="flex flex-wrap justify-center items-center mt-3 w-80">
        <input
          type="time"
          placeholder="From"
          value={'08:00'}
          className="input input-bordered w-[48%]"
        />
        -
        <input
          type="time"
          placeholder="To"
          value={'16:00'}
          className="input input-bordered w-[48%]"
        />
        <textarea
          className="textarea textarea-bordered mt-3 w-full"
          placeholder="Comment"
        ></textarea>
        <button className="btn mt-3 w-full">Submit</button>
      </div>
      <ExistingWorklogs worklogs={worklogs} />
    </div>
  );
}
