import { getWorklogs } from '@/repository/worklogRepository';
import WorklogEntry from './worklogEntry';
import { onWorklogSubmit } from '@/actions';
import { endOfDay, startOfDay } from '@/util/date';
import { assertExists, assertIsISODay } from '@/util/assertionFunctions';
import { getSettings } from '@/repository/settingsRepository';

export default async function WorklogEntryPage({
  searchParams,
}: {
  searchParams: { day: string };
}) {
  const settings = await getSettings();
  assertExists(settings);

  assertIsISODay(searchParams.day);
  const worklogs = await getWorklogs(
    startOfDay(searchParams.day),
    endOfDay(searchParams.day),
  );
  return (
    <WorklogEntry
      key={searchParams.day}
      day={searchParams.day}
      defaults={{
        fromDefault: settings.fromDefault,
        toDefault: settings.toDefault,
      }}
      worklogs={worklogs}
      onSubmit={onWorklogSubmit}
    />
  );
}
