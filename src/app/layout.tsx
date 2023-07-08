import './globals.css';
import { Inter } from 'next/font/google';
import AuthenticatedContent from '@/auth/authenticatedContent';
import AuthActions from '@/auth/authActions';
import { AuthProvider } from '@/auth/authProvider';
import Link from 'next/link';
import { onAfterSignin } from '@/actions';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={`${inter.className} bg-base-100 text-base-content`}>
        <AuthProvider>
          <div className="flex flex-col">
            <header className="flex justify-between items-center p-2 h-12 text-primary-content bg-primary">
              <Link href="/" className="text-2xl">
                saldo
              </Link>
              <AuthActions onAfterSignIn={onAfterSignin} />
            </header>
            <AuthenticatedContent>{children}</AuthenticatedContent>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
