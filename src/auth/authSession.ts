import 'server-only';

import { getUser } from '@/repository/userRepository';
import { assertExists } from '@/util/assertionFunctions';
import { NextAuthOptions, getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import { onAfterSignin, onCredentialsSignin } from '@/actions';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'email & password',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials) {
          return null;
        }
        const user = await onCredentialsSignin(
          credentials.email,
          credentials.password,
        );

        return user
          ? { email: user.email, name: user.name, id: String(user.id) }
          : null;
      },
    }),
    GoogleProvider({
      clientId: String(process.env.GOOGLE_CLIENT_ID),
      clientSecret: String(process.env.GOOGLE_CLIENT_SECRET),
    }),
    GitHubProvider({
      clientId: String(process.env.GITHUB_CLIENT_ID),
      clientSecret: String(process.env.GITHUB_CLIENT_SECRET),
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  events: {
    signIn: async ({ user }) => {
      if (!user.email) return;
      await onAfterSignin({
        email: user.email,
        name: user.name ?? '',
      });
    },
  },
};

export async function getSession() {
  const session = await getServerSession(authOptions);
  return session;
}
export async function getUserFromSession() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  assertExists(session.user);
  const user = await getUser(session.user.email ?? '');
  return user;
}
