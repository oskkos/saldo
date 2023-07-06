'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import { MdAccountCircle, MdLogin, MdLogout } from 'react-icons/md';

export default function AuthActions() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return null;
  }
  if (status === 'authenticated') {
    if (session.user) {
    }
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
          className="h-6 w-6"
          onClick={() => {
            void signOut();
          }}
          title="Sign out"
        />
      </div>
    );
  }
  return (
    <button
      className="btn btn-sm"
      onClick={() => {
        void signIn('google');
      }}
    >
      <MdLogin />
    </button>
  );
}
