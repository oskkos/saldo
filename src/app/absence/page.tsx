import Absence from './absence';
import { getUserFromSession } from '@/auth/authSession';

export default async function AbsencePage() {
  const user = await getUserFromSession();

  return <Absence userId={user.id} />;
}
