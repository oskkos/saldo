import { getSettings } from '@/repository/settingsRepository';
import { getWorklogs } from '@/repository/worklogRepository';
import { startOfMonth } from '@/util/date';
import MiniCalendar from '@/components/miniCalendar';
import { assertExists, assertIsYearAndMonth } from '@/util/assertionFunctions';
import { Date_YearAndMonth } from '@/util/dateFormatter';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const worklogs = await getWorklogs();
  const settings = await getSettings();
  assertExists(settings);
  const params = await searchParams;
  if (params.month) {
    assertIsYearAndMonth(params.month);
  }
  return (
    <div className="flex flex-wrap justify-center mt-4">
      <MiniCalendar
        date={startOfMonth((params.month as Date_YearAndMonth) || undefined)}
        beginDate={settings.beginDate}
        worklogs={worklogs}
      />
    </div>
  );
}
