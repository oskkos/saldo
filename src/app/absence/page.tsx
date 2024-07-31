import Absence from './absence';
import { getUserFromSession } from '@/auth/authSession';

export default async function AbsencePage() {
  const user = await getUserFromSession();
  if (!user) {
    return null;
  }

  return <Absence userId={user.id} />;
}
