import { getWorklogs } from '@/repository/worklogRepository';
import { getSettings } from '@/repository/settingsRepository';
import WorklogItems from './worklogItems';
import { sortWorklogs } from '@/services';
import { assertExists } from '@/util/assertionFunctions';

export default async function WorklogItemsPage() {
  const worklogs = await getWorklogs();
  const settings = await getSettings();
  assertExists(settings);
  return <WorklogItems worklogs={sortWorklogs(worklogs)} settings={settings} />;
}
