import { getSettings } from '@/repository/userRepository';
import { getWorklogs } from '@/repository/worklogRepository';
import { startOfMonth } from '@/util/date';
import MiniCalendar from '@/components/miniCalendar';
import { getSession, getUserFromSession } from '@/auth/authSession';
import { assertExists, assertIsYearAndMonth } from '@/util/assertionFunctions';
import { Date_YearAndMonth } from '@/util/dateFormatter';

export default async function Home({
  searchParams,
}: {
  searchParams: { month: string };
}) {
  const session = await getSession();
  if (!session) {
    return null;
  }
  const user = await getUserFromSession();
  if (!user) {
    return null;
  }
  const worklogs = await getWorklogs(user.id);
  const settings = await getSettings(user.id);
  assertExists(settings);
  if (searchParams.month) {
    assertIsYearAndMonth(searchParams.month);
  }
  return (
    <div className="flex flex-wrap justify-center mt-4">
      <MiniCalendar
        date={startOfMonth(
          (searchParams.month as Date_YearAndMonth) || undefined,
        )}
        beginDate={settings.begin_date}
        worklogs={worklogs}
      />
    </div>
  );
}
