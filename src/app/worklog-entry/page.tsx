import { getWorklogs } from '@/repository/worklogRepository';
import WorklogEntry from './worklogEntry';
import { onWorklogSubmit } from '@/actions';
import { endOfDay, startOfDay } from '@/util/date';
import { assertExists, assertIsISODay } from '@/util/assertionFunctions';
import { getSettings } from '@/repository/settingsRepository';
import { getExpectedHoursOverrides } from '@/repository/expectedHoursOverrideRepository';
import { expectedMinutesByDay, resolveExpectedMinutes } from '@/services';
import { toISODay } from '@/util/dateFormatter';

export default async function WorklogEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ day: string }>;
}) {
  const settings = await getSettings();
  assertExists(settings);

  const params = await searchParams;
  assertIsISODay(params.day);
  const worklogs = await getWorklogs(
    startOfDay(params.day),
    endOfDay(params.day),
  );
  const overrides = await getExpectedHoursOverrides();
  const override =
    overrides.find((o) => toISODay(o.date) === params.day) ?? null;
  const expectedMinutes = resolveExpectedMinutes(
    startOfDay(params.day),
    settings.expectedMinutesPerDay,
    expectedMinutesByDay(overrides),
  );
  return (
    <WorklogEntry
      key={params.day}
      day={params.day}
      defaults={{
        fromDefault: settings.fromDefault,
        toDefault: settings.toDefault,
      }}
      worklogs={worklogs}
      onSubmit={onWorklogSubmit}
      expectedMinutes={expectedMinutes}
      override={override}
    />
  );
}
