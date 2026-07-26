import 'server-only';

import { cache } from 'react';
import { prisma } from './prisma';
import { Worklog as PrismaWorklog } from '@/generated/prisma/client';
import { Worklog, WorklogFormData } from '@/types';
import { assertIsAbsenceReason } from '@/util/assertionFunctions';
import * as Sentry from '@sentry/nextjs';
import { getUserFromSession } from '@/auth/authSession';
import { absenceConflictMessage } from '@/services';
import { endOfDay, startOfDay } from '@/util/date';
import { Date_ISODay, toISODay } from '@/util/dateFormatter';

const toAbsenceReason = (absence: string | null) => {
  if (!absence) {
    return null;
  }
  assertIsAbsenceReason(absence);
  return absence;
};
const toWorklog = (worklog: PrismaWorklog): Worklog => ({
  id: worklog.id,
  from: worklog.from,
  to: worklog.to,
  comment: worklog.comment,
  subtractLunchBreak: worklog.subtract_lunch_break,
  absence: toAbsenceReason(worklog.absence),
});

// Cached per request (keyed on from/to) so callers sharing the same range —
// e.g. the root layout (Navbar) and the home page — read once instead of twice.
// Distinct ranges get distinct cache entries.
export const getWorklogs = cache(
  async (from?: Date, to?: Date): Promise<Worklog[]> => {
    const user = await getUserFromSession();
    if (!user) {
      throw new Error('User not found in session.');
    }

    return await Sentry.startSpan(
      { name: 'getWorklogs', op: 'db.sql.prisma' },
      async (span) => {
        const worklogs = await prisma.worklog.findMany({
          where: {
            user_id: user.id,
            from: { gte: from },
            to: { lte: to },
          },
        });

        span.setAttributes({
          userId: user.id,
          from: from?.toISOString() ?? 'beginning',
          to: to?.toISOString() ?? 'end',
          records: worklogs.length,
        });

        return worklogs.map(toWorklog);
      },
    );
  },
);

// The UTC calendar days in the range that already hold one of the user's
// absences. An absence occupies a whole day, so its `from` alone identifies it.
async function absenceDaysFor(
  userId: number,
  from: Date,
  to: Date,
): Promise<Date_ISODay[]> {
  return await Sentry.startSpan(
    { name: 'getAbsenceDays', op: 'db.sql.prisma' },
    async (span) => {
      const rows = await prisma.worklog.findMany({
        where: {
          user_id: userId,
          absence: { not: null },
          from: { gte: startOfDay(from), lte: endOfDay(to) },
        },
        select: { from: true },
      });

      span.setAttributes({ userId, records: rows.length });

      return rows.map((row) => toISODay(row.from));
    },
  );
}

export async function getAbsenceDays(
  from: Date,
  to: Date,
): Promise<Date_ISODay[]> {
  const user = await getUserFromSession();
  if (!user) {
    throw new Error('User not found in session.');
  }
  return await absenceDaysFor(user.id, from, to);
}

// A day holds at most one absence. This is the invariant the write paths share,
// enforced here beside the ownership check rather than in the actions, because
// it needs a read of stored state and because not every write reaches the table
// through the same action (clockRepository writes its own row).
async function assertAbsenceDaysAreFree(userId: number, days: Date_ISODay[]) {
  if (days.length === 0) {
    return;
  }
  // ISO days sort chronologically, so the ends bound the query.
  const sorted = [...days].sort();
  const taken = new Set(
    await absenceDaysFor(
      userId,
      startOfDay(sorted[0]),
      endOfDay(sorted[sorted.length - 1]),
    ),
  );
  const conflicts = sorted.filter((day) => taken.has(day));
  if (conflicts.length > 0) {
    throw new Error(absenceConflictMessage(conflicts));
  }
}

export async function insertWorklog({
  from,
  to,
  comment,
  subtractLunchBreak,
  absence,
}: WorklogFormData): Promise<Worklog> {
  const user = await getUserFromSession();
  if (!user) {
    throw new Error('User not found in session.');
  }
  if (absence) {
    await assertAbsenceDaysAreFree(user.id, [toISODay(from)]);
  }

  return await Sentry.startSpan(
    { name: 'insertWorklog', op: 'db.sql.prisma' },
    async () => {
      const worklog = await prisma.worklog.create({
        data: {
          from,
          to,
          comment,
          user_id: user.id,
          subtract_lunch_break: subtractLunchBreak,
          absence,
        },
      });
      return toWorklog(worklog);
    },
  );
}

// Every record in one statement, so a range is written whole or not at all.
// `createManyAndReturn` is a single INSERT ... RETURNING: there is no window in
// which part of a range is persisted.
export async function insertWorklogs(
  data: WorklogFormData[],
): Promise<Worklog[]> {
  const user = await getUserFromSession();
  if (!user) {
    throw new Error('User not found in session.');
  }
  await assertAbsenceDaysAreFree(
    user.id,
    data.filter((entry) => entry.absence).map((entry) => toISODay(entry.from)),
  );

  return await Sentry.startSpan(
    { name: 'insertWorklogs', op: 'db.sql.prisma' },
    async (span) => {
      const worklogs = await prisma.worklog.createManyAndReturn({
        data: data.map((entry) => ({
          from: entry.from,
          to: entry.to,
          comment: entry.comment,
          user_id: user.id,
          subtract_lunch_break: entry.subtractLunchBreak,
          absence: entry.absence,
        })),
      });

      span.setAttributes({ userId: user.id, records: worklogs.length });

      return worklogs.map(toWorklog);
    },
  );
}

async function getWorklog(worklogId: number) {
  return await Sentry.startSpan(
    { name: 'getWorklog', op: 'db.sql.prisma' },
    async () => {
      return await prisma.worklog.findUniqueOrThrow({
        where: { id: worklogId },
      });
    },
  );
}

export async function updateWorklog(
  worklogId: number,
  { from, to, comment, subtractLunchBreak }: WorklogFormData,
): Promise<Worklog> {
  const user = await getUserFromSession();
  if (!user) {
    throw new Error('User not found in session.');
  }
  const worklog = await getWorklog(worklogId);
  if (worklog.user_id !== user.id) {
    throw new Error('User mismatch.');
  }
  // Only a stored absence can collide: a regular worklog may move onto a day
  // that already has an absence, which is the whole point of working during
  // one. An absence stays an absence through an edit (the column is never
  // written here), so the stored value is the whole test.
  const targetDay = toISODay(from);
  if (worklog.absence && targetDay !== toISODay(worklog.from)) {
    await assertAbsenceDaysAreFree(user.id, [targetDay]);
  }

  return await Sentry.startSpan(
    { name: 'updateWorklog', op: 'db.sql.prisma' },
    async () => {
      const worklog = await prisma.worklog.update({
        where: { id: worklogId },
        data: {
          from,
          to,
          comment,
          subtract_lunch_break: subtractLunchBreak,
        },
      });
      return toWorklog(worklog);
    },
  );
}

export async function deleteWorklog(worklogId: number): Promise<void> {
  const user = await getUserFromSession();
  if (!user) {
    throw new Error('User not found in session.');
  }
  const worklog = await getWorklog(worklogId);
  if (worklog.user_id !== user.id) {
    throw new Error('User mismatch.');
  }

  return await Sentry.startSpan(
    { name: 'deleteWorklog', op: 'db.sql.prisma' },
    async () => {
      await prisma.worklog.delete({
        where: { id: worklogId },
      });
    },
  );
}
