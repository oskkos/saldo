'use client';

import Image from 'next/image';
import { signIn } from 'next-auth/react';

const OAuthButton = ({
  name,
  id,
  imgSrc,
}: {
  name: string;
  id: string;
  imgSrc: string;
}) => (
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  <button className="btn btn-lg w-1/2 px-2 gap-1" onClick={() => signIn(id)}>
    <Image alt={`${name} logo`} height="24" width="24" src={imgSrc} />
    <span className="text-xs mt-0">Sign in with {name}</span>
  </button>
);

export function OAuthSignin() {
  return (
    <div className="flex items-center gap-2 mt-4">
      <OAuthButton name="Google" id="google" imgSrc="/img/google.svg" />
      <OAuthButton name="GitHub" id="github" imgSrc="/img/github.svg" />
    </div>
  );
}
