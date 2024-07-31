'use client';

import type { Session } from 'next-auth';
import { signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import { MdAccountCircle, MdLogin, MdLogout } from 'react-icons/md';

export default function AuthActions({
  session,
  className,
}: {
  session: Session | null;
  className: string;
}) {
  if (session) {
    return (
      <div className="flex items-center">
        {session.user?.image ? (
          <Image
            src={session.user.image}
            alt="Profile picture"
            width={32}
            height={32}
            className={className}
            title={session.user.name ?? ''}
          />
        ) : (
          <MdAccountCircle className={className} />
        )}
        <MdLogout
          className={`${className} cursor-pointer`}
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
      className={`${className} cursor-pointer`}
      onClick={() => {
        void signIn();
      }}
      title="Sign in"
    />
  );
}
