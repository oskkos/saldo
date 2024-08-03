import 'server-only';

import { getUserFromSession } from '@/auth/authSession';

export const assertUserMatchWithSession = async (user: {
  id?: number | string;
  email?: string;
}) => {
  const sessionUser = await getUserFromSession();
  if (!sessionUser) {
    throw new Error('User not found in session.');
  }
  if (user.id && user.id != sessionUser.id) {
    throw new Error('User mismatch.');
  }
  if (user.email && user.email !== sessionUser.email) {
    throw new Error('User mismatch.');
  }
};
