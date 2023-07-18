import { getUser } from '@/repository/userRepository';
import { getSession } from '../api/auth/[...nextauth]/route';
import Absence from './absence';

export default async function AbsencePage() {
  const session = await getSession();
  if (!session) {
    throw new Error('No session!');
  }
  const user = await getUser(session.user?.email ?? '');

  return <Absence userId={user.id} />;
}
