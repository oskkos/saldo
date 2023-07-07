import NextAuth, { NextAuthOptions, getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const opts: NextAuthOptions = {
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

// TODO: Move to some util place
export async function getSession() {
  const session = await getServerSession(opts);
  if (!session) {
    throw new Error('No session!');
  }
  return session;
}

// eslint-disable-next-line @typescript-eslint/ban-types
const handler = NextAuth(opts) as Function | undefined;

export { handler as GET, handler as POST };
