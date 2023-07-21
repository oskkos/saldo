import Absence from './absence';
import { getSession, getUserFromSession } from '@/auth/authSession';

export default async function AbsencePage() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  const user = await getUserFromSession();

  return <Absence userId={user.id} />;
}
