import 'server-only';

import { cache } from 'react';
import { prisma } from './prisma';
import { ActiveSession, WorklogFormData } from '@/types';
import * as Sentry from '@sentry/nextjs';
import { getUserFromSession } from '@/auth/authSession';

// Cached per request so the layout (badge) and the home page (clock card) share
// a single read instead of querying started_at twice.
export const getActiveSession = cache(
  async (): Promise<ActiveSession | null> => {
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
  },
);

// Clock out atomically: create the worklog and clear the open session in one
// transaction, so a failure can't leave a logged worklog with the session still
// open (which would let a retry double-log).
export async function clockOutWithWorklog(
  data: WorklogFormData,
): Promise<void> {
  const user = await getUserFromSession();
  if (!user) {
    throw new Error('User not found in session.');
  }

  await Sentry.startSpan(
    { name: 'clockOutWithWorklog', op: 'db.sql.prisma' },
    async () => {
      await prisma.$transaction(async (tx) => {
        await tx.worklog.create({
          data: {
            from: data.from,
            to: data.to,
            comment: data.comment,
            user_id: user.id,
            subtract_lunch_break: data.subtractLunchBreak,
            absence: data.absence ?? null,
          },
        });
        await tx.user.update({
          where: { id: user.id },
          data: { started_at: null },
        });
      });
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
