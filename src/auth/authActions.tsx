'use client';

import { AuthUser } from '@/types/user';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import { useEffect } from 'react';
import { MdAccountCircle, MdLogin, MdLogout } from 'react-icons/md';

export default function AuthActions({
  onAfterSignIn,
}: {
  onAfterSignIn: (user: AuthUser) => Promise<void>;
}) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && session.user?.email) {
      void onAfterSignIn({
        email: session.user.email,
        name: session.user.name ?? '',
      });
    }
  }, [session, status, onAfterSignIn]);

  if (status === 'loading') {
    return null;
  }
  if (status === 'authenticated') {
    return (
      <div className="flex items-center">
        {session.user?.image ? (
          <Image
            src={session.user.image}
            alt="Profile picture"
            width={32}
            height={32}
            className="mr-2 rounded-full h-8 w-8"
            title={session.user.name ?? ''}
          />
        ) : (
          <MdAccountCircle className="mr-2 rounded-full h-8 w-8" />
        )}
        <MdLogout
          className="h-6 w-6 cursor-pointer"
          onClick={() => {
            void signOut();
          }}
          title="Sign out"
        />
      </div>
    );
  }
  return (
    <MdLogin
      className="h-6 w-6 cursor-pointer"
      onClick={() => {
        void signIn('google');
      }}
      title="Sign in"
    />
  );
}
