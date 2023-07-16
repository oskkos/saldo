import MiniCalendar from '@/app/components/miniCalendar';
import { getSettings, getUser } from '@/repository/userRepository';
import { getSession } from './api/auth/[...nextauth]/route';
import { getWorklogs } from '@/repository/worklogRepository';
import { startOfMonth } from '@/util/date';

export default async function Home({
  searchParams,
}: {
  searchParams: { month: string };
}) {
  const session = await getSession();
  if (!session) {
    throw new Error('No session');
  }
  const user = await getUser(session.user?.email ?? '');
  const worklogs = await getWorklogs(user.id);
  const settings = await getSettings(user.id);
  if (!settings) {
    throw new Error('No settings');
  }

  return (
    <div className="flex flex-wrap justify-center mt-4">
      <MiniCalendar
        date={
          searchParams.month
            ? startOfMonth(searchParams.month)
            : startOfMonth(new Date())
        }
        beginDate={settings.begin_date}
        worklogs={worklogs}
      />
    </div>
  );
}
