import MiniCalendar from '@/app/components/miniCalendar';
import { getSession } from './api/auth/[...nextauth]/route';
import { getSettings, getUser } from '@/repository/userRepository';
import { getWorklogs } from '@/repository/worklogRepository';
import { calculateCurrentSaldo } from '@/services';

export default async function Home() {
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
    <div className="flex flex-wrap justify-center mt-4">
      <MiniCalendar date={new Date()} />
      <div className="flex flex-wrap flex-col justify-center items-center mt-4">
        <h2 className="text-xl">Current balance</h2>
        {saldo.toBadge()}
      </div>
    </div>
  );
}
