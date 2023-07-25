'use client';

import { Settings, User } from '@prisma/client';
import { signIn, useSession } from 'next-auth/react';
import { MdLockOutline } from 'react-icons/md';

export default function AuthenticatedContent({
  user,
  settings,
  children,
}: {
  user: User | null;
  settings: Settings | null;
  children: React.ReactNode;
}) {
  const { status } = useSession();

  if (
    status === 'loading' ||
    (status === 'authenticated' && (!user || !settings))
  ) {
    return (
      <div className="flex justify-center items-center mt-5">
        <span className="loading loading-dots loading-lg"></span>
      </div>
    );
  }
  if (status === 'authenticated') {
    return <div className="overflow-auto">{children}</div>;
  }
  return (
    <div className="flex justify-center items-center mt-5">
      <MdLockOutline
        className="w-32 h-32"
        onClick={() => {
          void signIn('google');
        }}
      />
    </div>
  );
}
