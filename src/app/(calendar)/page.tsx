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
  // These reads are independent, so dispatch them together and let their
  // latencies overlap instead of summing (matters most on a Neon cold start).
  const [worklogs, settings, overrides, activeSession, params] =
    await Promise.all([
      getWorklogs(),
      getSettings(),
      getExpectedHoursOverrides(),
      getActiveSession(),
      searchParams,
    ]);
  assertExists(settings);
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
