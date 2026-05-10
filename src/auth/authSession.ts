import 'server-only';

import { getUser } from '@/repository/userRepository';
import { NextAuthOptions, getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import { onAfterSignin, onCredentialsSignin } from '@/actions';
import type { User } from '@/types';

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
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.email) {
        const [u] = await onAfterSignin({
          email: user.email,
          name: user.name ?? '',
        });
        token.userId = u.id;
      } else if (token.userId === undefined && token.email) {
        const existing = await getUser(token.email);
        if (existing) token.userId = existing.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && typeof token.userId === 'number') {
        session.user.id = token.userId;
      }
      return session;
    },
  },
};

export async function getSession() {
  const session = await getServerSession(authOptions);
  return session;
}
export async function getUserFromSession(): Promise<User | null> {
  const session = await getSession();
  if (!session?.user?.email || typeof session.user.id !== 'number') {
    return null;
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? '',
  };
}
