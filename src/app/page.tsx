import { getSettings } from '@/repository/userRepository';
import { getWorklogs } from '@/repository/worklogRepository';
import { startOfMonth } from '@/util/date';
import MiniCalendar from '@/components/miniCalendar';
import { getUserFromSession } from '@/auth/authSession';

export default async function Home({
  searchParams,
}: {
  searchParams: { month: string };
}) {
  const user = await getUserFromSession();
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
