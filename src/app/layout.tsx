import 'server-only';

import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/auth/authProvider';
import Navbar from '@/components/navbar';
import { getSession } from '@/auth/authSession';
import { getSettings } from '@/repository/settingsRepository';
import { getWorklogs } from '@/repository/worklogRepository';
import { getActiveSession } from '@/repository/clockRepository';
import { warmUpDb } from '@/repository/warmup';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'saldo',
  description: 'Logging work hours made easy',
};

// This layout renders on every route and performs the Navbar's DB reads
// (settings/worklogs/active session, plus overrides via the saldo badge), so a
// Neon cold start can hit any route's first load — not just `/`. Set the
// duration guard here, at the root segment, so every nested route inherits the
// headroom to finish a cold wake instead of being killed at the platform
// default.
export const maxDuration = 30;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  // Wake the Neon compute once before the concurrent reads below, so a cold
  // start is paid a single time rather than raced by each read's connection.
  if (session) {
    await warmUpDb();
  }
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
