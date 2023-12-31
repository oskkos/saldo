import { getUser } from '@/repository/userRepository';
import { assertExists } from '@/util/assertionFunctions';
import { NextAuthOptions, getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: String(process.env.GOOGLE_CLIENT_ID),
      clientSecret: String(process.env.GOOGLE_CLIENT_SECRET),
    }),
  ],
  session: {
    strategy: 'jwt',
  },
};

export async function getSession() {
  const session = await getServerSession(authOptions);
  return session;
}
export async function getUserFromSession() {
  const session = await getSession();
  assertExists(session?.user);
  const user = await getUser(session.user.email ?? '');
  return user;
}
