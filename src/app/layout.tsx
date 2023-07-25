import 'server-only';

import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/auth/authProvider';
import Navbar from '@/components/navbar';
import { getSession } from '@/auth/authSession';
import { onAfterSignin } from '@/actions';
import { getWorklogs } from '@/repository/worklogRepository';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'saldo',
  description: 'Logging work hours made easy',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const data = session?.user?.email
    ? await onAfterSignin({
        email: session.user.email,
        name: session.user.name ?? '',
      })
    : null;
  const user = data?.[0] ?? null;
  const settings = data?.[1] ?? null;
  const worklogs = user ? await getWorklogs(user.id) : [];

  return (
    <html lang="en">
      <body className={`${inter.className} bg-base-100 text-base-content`}>
        <AuthProvider>
          <Navbar
            user={user}
            settings={settings}
            session={session}
            worklogs={worklogs}
          >
            {children}
          </Navbar>
        </AuthProvider>
      </body>
    </html>
  );
}
