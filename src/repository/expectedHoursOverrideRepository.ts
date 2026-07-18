import 'server-only';

import { cache } from 'react';
import { prisma } from './prisma';
import { ExpectedHoursOverride as PrismaOverride } from '@/generated/prisma/client';
import { ExpectedHoursOverride, ExpectedHoursOverrideData } from '@/types';
import * as Sentry from '@sentry/nextjs';
import { getUserFromSession } from '@/auth/authSession';
import { startOfDay } from '@/util/date';

const toOverride = (o: PrismaOverride): ExpectedHoursOverride => ({
  id: o.id,
  date: o.date,
  minutes: o.minutes,
  label: o.label,
});

// Cached per request so the saldo badge (in the Navbar) and the page share a
// single read instead of querying overrides twice.
export const getExpectedHoursOverrides = cache(
  async (): Promise<ExpectedHoursOverride[]> => {
    const user = await getUserFromSession();
    if (!user) {
      throw new Error('User not found in session.');
    }

    return await Sentry.startSpan(
      { name: 'getExpectedHoursOverrides', op: 'db.sql.prisma' },
      async () => {
        const overrides = await prisma.expectedHoursOverride.findMany({
          where: { user_id: user.id },
          orderBy: { date: 'asc' },
        });
        return overrides.map(toOverride);
      },
    );
  },
);

export async function upsertExpectedHoursOverride({
  date,
  minutes,
  label,
}: ExpectedHoursOverrideData): Promise<ExpectedHoursOverride> {
  const user = await getUserFromSession();
  if (!user) {
    throw new Error('User not found in session.');
  }
  // Normalize to UTC start-of-day so one date maps to one override row.
  const day = startOfDay(date);

  return await Sentry.startSpan(
    { name: 'upsertExpectedHoursOverride', op: 'db.sql.prisma' },
    async () => {
      const override = await prisma.expectedHoursOverride.upsert({
        where: { user_id_date: { user_id: user.id, date: day } },
        create: { user_id: user.id, date: day, minutes, label: label ?? null },
        update: { minutes, label: label ?? null },
      });
      return toOverride(override);
    },
  );
}

export async function deleteExpectedHoursOverride(id: number): Promise<void> {
  const user = await getUserFromSession();
  if (!user) {
    throw new Error('User not found in session.');
  }
  const existing = await Sentry.startSpan(
    { name: 'getExpectedHoursOverride', op: 'db.sql.prisma' },
    async () =>
      await prisma.expectedHoursOverride.findUniqueOrThrow({ where: { id } }),
  );
  if (existing.user_id !== user.id) {
    throw new Error('User mismatch.');
  }

  return await Sentry.startSpan(
    { name: 'deleteExpectedHoursOverride', op: 'db.sql.prisma' },
    async () => {
      await prisma.expectedHoursOverride.delete({ where: { id } });
    },
  );
}
