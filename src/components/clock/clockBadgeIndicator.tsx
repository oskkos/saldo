'use client';

import Link from 'next/link';
import { ActiveSession } from '@/types';

// Always-visible clocked-in indicator shown next to the saldo badge: a pulsing
// dot linking to the home screen where the user clocks out.
export default function ClockBadgeIndicator({
  activeSession,
}: {
  activeSession: ActiveSession | null;
}) {
  if (!activeSession) {
    return null;
  }
  return (
    <Link
      href="/"
      className="badge badge-success badge-sm px-1 gap-1"
      title="Clocked in"
    >
      <span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse" />
    </Link>
  );
}
