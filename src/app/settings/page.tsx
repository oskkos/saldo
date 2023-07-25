import { getSettings } from '@/repository/userRepository';
import Settings from './settings';
import { getSession, getUserFromSession } from '@/auth/authSession';
import { assertExists } from '@/util/assertionFunctions';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  const user = await getUserFromSession();
  if (!user) {
    return null;
  }
  const settings = await getSettings(user.id);
  assertExists(settings);
  return <Settings settings={settings} />;
}
