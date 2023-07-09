import './globals.css';
import { Inter } from 'next/font/google';
import AuthenticatedContent from '@/auth/authenticatedContent';
import AuthActions from '@/auth/authActions';
import { AuthProvider } from '@/auth/authProvider';
import Link from 'next/link';
import { onAfterSignin } from '@/actions';
import Navbar from './components/navbar';

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
          <Navbar>{children}</Navbar>
        </AuthProvider>
      </body>
    </html>
  );
}
