import { ReactNode } from 'react';

// Shared error-toast message body: a title plus the error's message when available.
export function errorToastMessage(title: string, error: unknown): ReactNode {
  const detail =
    error instanceof Error ? (
      <div className="text-sm">{error.message}</div>
    ) : null;
  return (
    <div>
      <div>{title}</div>
      {detail}
    </div>
  );
}
