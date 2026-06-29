import 'server-only';

import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/auth/authProvider';
import Navbar from '@/components/navbar';
import { getSession } from '@/auth/authSession';
import { getSettings } from '@/repository/settingsRepository';
import { getWorklogs } from '@/repository/worklogRepository';
import { getActiveSession } from '@/repository/clockRepository';

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
  const [settings, worklogs, activeSession] = session
    ? await Promise.all([getSettings(), getWorklogs(), getActiveSession()])
    : [null, [], null];

  return (
    <html lang="en">
      <body className={`${inter.className} bg-base-100 text-base-content`}>
        <AuthProvider session={session}>
          <Navbar
            settings={settings}
            session={session}
            worklogs={worklogs}
            activeSession={activeSession}
          >
            {children}
          </Navbar>
        </AuthProvider>
      </body>
    </html>
  );
}
