import { getSettings } from '@/repository/settingsRepository';
import Settings from './settings';
import { getUserFromSession } from '@/auth/authSession';
import { assertExists } from '@/util/assertionFunctions';

export default async function SettingsPage() {
  const user = await getUserFromSession();
  if (!user) {
    return null;
  }
  const settings = await getSettings(user.id);
  assertExists(settings);
  return <Settings settings={settings} />;
}
