'use client';

import { MdError } from 'react-icons/md';

export default function GlobalError({
  error,
}: {
  error: Error & { digest: number };
}) {
  return (
    <div className="flex flex-col justify-center items-center">
      <div className="m-9 p-9 bg-neutral text-neutral-content shadow rounded">
        <MdError className="w-16 h-16 text-error" />
        <h3 className="text-xl font-bold">
          Oops, something just went sideways
        </h3>
        <p className="mt-3 text-reg font-bold">{error.message}</p>
        <p className="mt-6 text-sm font-light">Error code: {error.digest}</p>
      </div>
    </div>
  );
}
