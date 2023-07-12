import { getSettings, getUser } from '@/repository/userRepository';
import { getSession } from '../api/auth/[...nextauth]/route';
import Settings from './settings';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    throw new Error('No session!');
  }
  const user = await getUser(session.user?.email ?? '');
  const settings = await getSettings(user.id);
  if (!settings) {
    throw new Error('No session!');
  }

  return <Settings settings={settings} />;
}
