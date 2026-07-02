import { getSettings } from '@/repository/settingsRepository';
import { getWorklogs } from '@/repository/worklogRepository';
import { getExpectedHoursOverrides } from '@/repository/expectedHoursOverrideRepository';
import { getActiveSession } from '@/repository/clockRepository';
import { startOfMonth } from '@/util/date';
import MiniCalendar from '@/components/miniCalendar';
import ClockCard from '@/components/clock/clockCard';
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
  const overrides = await getExpectedHoursOverrides();
  const activeSession = await getActiveSession();
  const params = await searchParams;
  if (params.month) {
    assertIsYearAndMonth(params.month);
  }
  return (
    <div className="flex flex-col items-center mt-4 gap-4">
      <MiniCalendar
        date={startOfMonth((params.month as Date_YearAndMonth) || undefined)}
        beginDate={settings.beginDate}
        worklogs={worklogs}
        expectedMinutesPerDay={settings.expectedMinutesPerDay}
        overrides={overrides}
      />
      <div className="w-full flex justify-center px-4">
        <ClockCard activeSession={activeSession} />
      </div>
    </div>
  );
}
