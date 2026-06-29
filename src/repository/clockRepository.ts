import 'server-only';

import { prisma } from './prisma';
import { ActiveSession } from '@/types';
import * as Sentry from '@sentry/nextjs';
import { getUserFromSession } from '@/auth/authSession';

export async function getActiveSession(): Promise<ActiveSession | null> {
  const user = await getUserFromSession();
  if (!user) {
    throw new Error('User not found in session.');
  }

  return await Sentry.startSpan(
    { name: 'getActiveSession', op: 'db.sql.prisma' },
    async () => {
      const row = await prisma.user.findUnique({
        where: { id: user.id },
        select: { started_at: true },
      });
      return row?.started_at ? { startedAt: row.started_at } : null;
    },
  );
}

export async function clockIn(startedAt: Date): Promise<ActiveSession> {
  const user = await getUserFromSession();
  if (!user) {
    throw new Error('User not found in session.');
  }

  return await Sentry.startSpan(
    { name: 'clockIn', op: 'db.sql.prisma' },
    async () => {
      // Only start a session if none is open — keeps it idempotent and avoids
      // overwriting an existing clock-in.
      await prisma.user.updateMany({
        where: { id: user.id, started_at: null },
        data: { started_at: startedAt },
      });
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { started_at: true },
      });
      if (!row.started_at) {
        throw new Error('Failed to start session.');
      }
      return { startedAt: row.started_at };
    },
  );
}

export async function clearSession(): Promise<void> {
  const user = await getUserFromSession();
  if (!user) {
    throw new Error('User not found in session.');
  }

  return await Sentry.startSpan(
    { name: 'clearSession', op: 'db.sql.prisma' },
    async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { started_at: null },
      });
    },
  );
}
