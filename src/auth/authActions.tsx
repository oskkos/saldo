'use client';

import type { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import Image from 'next/image';
import { MdAccountCircle, MdLogout } from 'react-icons/md';

export default function AuthActions({
  session,
  className,
}: {
  session: Session;
  className: string;
}) {
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
        <MdAccountCircle
          className={className}
          title={session.user?.name ?? ''}
        />
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
