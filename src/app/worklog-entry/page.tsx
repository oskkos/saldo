import { getWorklogs } from '@/repository/worklogRepository';
import WorklogEntry from './worklogEntry';
import { onWorklogSubmit } from '@/actions';
import { endOfDay, startOfDay } from '@/util/date';
import { getUserFromSession } from '@/auth/authSession';
import { assertIsISODay } from '@/util/assertionFunctions';
import { getSettings } from '@/repository/settingsRepository';

export default async function WorklogEntryPage({
  searchParams,
}: {
  searchParams: { day: string };
}) {
  const user = await getUserFromSession();
  if (!user) {
    return null;
  }
  const settings = await getSettings(user.id);
  if (!settings) {
    return null;
  }

  assertIsISODay(searchParams.day);
  const worklogs = await getWorklogs(
    user.id,
    startOfDay(searchParams.day),
    endOfDay(searchParams.day),
  );
  return (
    <WorklogEntry
      key={searchParams.day}
      day={searchParams.day}
      defaults={{
        fromDefault: settings.from_default,
        toDefault: settings.to_default,
      }}
      worklogs={worklogs}
      onSubmit={onWorklogSubmit.bind(null, user.id)}
    />
  );
}
