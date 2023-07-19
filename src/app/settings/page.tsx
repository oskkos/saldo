import { getSettings } from '@/repository/userRepository';
import Settings from './settings';
import { getUserFromSession } from '@/auth/authSession';

export default async function SettingsPage() {
  const user = await getUserFromSession();
  const settings = await getSettings(user.id);
  if (!settings) {
    throw new Error('No settings!');
  }

  return <Settings settings={settings} />;
}
