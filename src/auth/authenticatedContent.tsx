'use client';

import { signIn, useSession } from 'next-auth/react';
import { MdLockOutline } from 'react-icons/md';

export default function AuthenticatedContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center mt-5">
        <span className="loading loading-dots loading-lg"></span>
      </div>
    );
  }
  if (status === 'authenticated') {
    return (
      <>
        <div className="h-96 grow shrink overflow-auto">{children}</div>
        <footer className="footer p-3 bg-neutral text-neutral-content">
          Home | Config | Worklog list
        </footer>
      </>
    );
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
