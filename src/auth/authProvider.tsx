'use client';

import ToastContextWrapper from '@/components/toastContext';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';

interface Props {
  session: Session | null;
  children?: React.ReactNode;
}

export const AuthProvider = ({ session, children }: Props) => {
  return (
    <SessionProvider session={session}>
      <ToastContextWrapper>{children}</ToastContextWrapper>
    </SessionProvider>
  );
};
