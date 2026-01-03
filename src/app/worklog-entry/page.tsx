import { getWorklogs } from '@/repository/worklogRepository';
import WorklogEntry from './worklogEntry';
import { onWorklogSubmit } from '@/actions';
import { endOfDay, startOfDay } from '@/util/date';
import { assertExists, assertIsISODay } from '@/util/assertionFunctions';
import { getSettings } from '@/repository/settingsRepository';

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
    />
  );
}
