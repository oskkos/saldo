import { getWorklogs } from '@/repository/worklogRepository';
import { getSettings } from '@/repository/settingsRepository';
import WorklogItems from './worklogItems';
import { sortWorklogs } from '@/services';
import { getUserFromSession } from '@/auth/authSession';
import { assertExists } from '@/util/assertionFunctions';

export default async function WorklogItemsPage() {
  const user = await getUserFromSession();
  if (!user) {
    return null;
  }
  const worklogs = await getWorklogs(user.id);
  const settings = await getSettings(user.id);
  assertExists(settings);
  return <WorklogItems worklogs={sortWorklogs(worklogs)} settings={settings} />;
}
