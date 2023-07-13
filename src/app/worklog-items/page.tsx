import { getWorklogs } from '@/repository/worklogRepository';
import { getSession } from '../api/auth/[...nextauth]/route';
import { getSettings, getUser } from '@/repository/userRepository';
import WorklogItems from './worklogItems';
import { calculateCurrentSaldo } from '@/services';

export default async function WorklogItemsPage() {
  const session = await getSession();
  if (!session) {
    throw new Error('No session!');
  }
  const user = await getUser(session.user?.email ?? '');
  const worklogs = await getWorklogs(user.id);
  const settings = await getSettings(user.id);
  if (!settings) {
    throw new Error('No settings!');
  }
  const saldo = calculateCurrentSaldo(settings, worklogs);

  return (
    <WorklogItems
      worklogs={worklogs.sort((a, b) => b.from.getTime() - a.from.getTime())}
      settings={settings}
      saldo={saldo.toBadge()}
    />
  );
}
