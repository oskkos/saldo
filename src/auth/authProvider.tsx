'use client';

import ToastContextWrapper from '@/components/toastContext';
import { SessionProvider } from 'next-auth/react';

interface Props {
  children?: React.ReactNode;
}

export const AuthProvider = ({ children }: Props) => {
  return (
    <SessionProvider>
      <ToastContextWrapper>{children}</ToastContextWrapper>
    </SessionProvider>
  );
};
