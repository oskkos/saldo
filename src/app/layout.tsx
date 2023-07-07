import './globals.css';
import { Inter } from 'next/font/google';
import AuthenticatedContent from '@/auth/authenticatedContent';
import AuthActions from '@/auth/authActions';
import { AuthProvider } from '@/auth/authProvider';
import { AuthUser } from '@/types/user';
import { upsertUser } from '@/repository/userRepository';

const inter = Inter({ subsets: ['latin'] });

const onAfterSignin = async (user: AuthUser) => {
  'use server';
  await upsertUser(user);
};

export const metadata = {
  title: 'saldo',
  description: 'Logging work hours made easy',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <div className="flex flex-col h-screen">
            <header className="flex justify-between items-center p-2 h-12 text-sky-200 bg-sky-900">
              <h1 className="text-2xl">saldo</h1>
              <AuthActions onAfterSignIn={onAfterSignin} />
            </header>
            <AuthenticatedContent className="flex-grow">
              {children}
            </AuthenticatedContent>
            <footer className="h-12 bg-stone-300">footer</footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
