'use client';

import { signIn, useSession } from 'next-auth/react';
import { MdLockOutline } from 'react-icons/md';

export default function AuthenticatedContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <div className={`${className ?? ''} flex justify-center items-center`}>
        <span className="loading loading-dots loading-lg"></span>
      </div>
    );
  }
  if (status === 'authenticated') {
    return <div className={className}>{children}</div>;
  }
  return (
    <div className={`${className ?? ''} flex justify-center items-center`}>
      <MdLockOutline
        className="w-32 h-32"
        onClick={() => {
          void signIn('google');
        }}
      />
    </div>
  );
}
