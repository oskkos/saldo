import { getSettings } from '@/repository/settingsRepository';
import Settings from './settings';
import { assertExists } from '@/util/assertionFunctions';

export default async function SettingsPage() {
  const settings = await getSettings();
  assertExists(settings);
  return <Settings settings={settings} />;
}
