import { getWorklogs } from '@/repository/worklogRepository';
import { getSettings } from '@/repository/userRepository';
import WorklogItems from './worklogItems';
import { sortWorklogs } from '@/services';
import { getSession, getUserFromSession } from '@/auth/authSession';
import { assertExists } from '@/util/assertionFunctions';

export default async function WorklogItemsPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  const user = await getUserFromSession();
  const worklogs = await getWorklogs(user.id);
  const settings = await getSettings(user.id);
  assertExists(settings);
  return <WorklogItems worklogs={sortWorklogs(worklogs)} settings={settings} />;
}
