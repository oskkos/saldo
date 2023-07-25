import Absence from './absence';
import { getSession, getUserFromSession } from '@/auth/authSession';

export default async function AbsencePage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  const user = await getUserFromSession();
  if (!user) {
    return null;
  }

  return <Absence userId={user.id} />;
}
