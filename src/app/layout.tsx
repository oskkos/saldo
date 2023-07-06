import './globals.css';
import { Inter } from 'next/font/google';
import AuthenticatedContent from '@/auth/authenticatedContent';
import AuthActions from '@/auth/authActions';
import { AuthProvider } from '@/auth/authProvider';

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
      <body className={inter.className}>
        <AuthProvider>
          <div className="flex flex-col h-screen">
            <header className="flex justify-between items-center p-2 h-12 text-sky-200 bg-sky-900">
              <h1 className="text-2xl">saldo</h1>
              <AuthActions />
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
