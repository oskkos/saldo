import 'server-only';

import { cache } from 'react';
import { prisma } from './prisma';
import { Worklog as PrismaWorklog } from '@/generated/prisma/client';
import { Worklog, WorklogFormData } from '@/types';
import { assertIsAbsenceReason } from '@/util/assertionFunctions';
import * as Sentry from '@sentry/nextjs';
import { getUserFromSession } from '@/auth/authSession';
import { AbsenceConflictError, WorklogOverlapError } from '@/services';
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
  // A day is taken either because one is already stored on it, or because the
  // batch itself asks for it twice.
  const conflicts = [
    ...new Set(
      sorted.filter((day, i) => taken.has(day) || sorted[i - 1] === day),
    ),
  ];
  if (conflicts.length > 0) {
    throw new AbsenceConflictError(conflicts);
  }
}

// The current user's stored *work* entries whose span collides with the given
// one. Absences are excluded: an absence claims the whole day by design, and
// working during one is a supported combination rather than a conflict.
//
// The candidate query is bounded by the incoming span itself. `from < to` is
// index-backed on (user_id, from); `to > from` then discards the earlier rows
// the index range still includes.
export async function overlappingWorkEntries(
  userId: number,
  from: Date,
  to: Date,
  excludeWorklogId?: number,
): Promise<Worklog[]> {
  return await Sentry.startSpan(
    { name: 'overlappingWorkEntries', op: 'db.sql.prisma' },
    async (span) => {
      const rows = await prisma.worklog.findMany({
        where: {
          user_id: userId,
          absence: null,
          from: { lt: to },
          to: { gt: from },
          ...(excludeWorklogId === undefined
            ? {}
            : { id: { not: excludeWorklogId } }),
        },
        orderBy: { from: 'asc' },
      });

      span.setAttributes({ userId, records: rows.length });

      return rows.map(toWorklog);
    },
  );
}

// A work entry may not silently land on top of another. This is advisory rather
// than absolute — the user is asked and may confirm through it, which is why it
// cannot be a database constraint — but the question has to be asked against
// stored state, because the case it exists for is a client whose view predates
// the entry it would collide with.
async function assertSpanIsFree(
  userId: number,
  from: Date,
  to: Date,
  excludeWorklogId?: number,
) {
  const conflicts = await overlappingWorkEntries(
    userId,
    from,
    to,
    excludeWorklogId,
  );
  if (conflicts.length > 0) {
    throw new WorklogOverlapError(
      conflicts.map((conflict) => ({ from: conflict.from, to: conflict.to })),
    );
  }
}

// `allowOverlap` carries the user's answer to that question back down. It
// bypasses the overlap check only; ownership, validation and the absence
// invariant are unaffected by it.
export type WriteOptions = { allowOverlap?: boolean };

export async function insertWorklog(
  { from, to, comment, subtractLunchBreak, absence }: WorklogFormData,
  { allowOverlap = false }: WriteOptions = {},
): Promise<Worklog> {
  const user = await getUserFromSession();
  if (!user) {
    throw new Error('User not found in session.');
  }
  if (absence) {
    await assertAbsenceDaysAreFree(user.id, [toISODay(from)]);
  } else if (!allowOverlap) {
    // Only a work entry is overlap-checked. An absence has its own one-per-day
    // guard above, and checking it here would flag every legitimate day that
    // holds both an absence and the hours worked during it.
    await assertSpanIsFree(user.id, from, to);
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
  { allowOverlap = false }: WriteOptions = {},
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
  // A stored absence keeps its exemption through the edit. A work entry is
  // checked against the others, excluding itself — otherwise nudging an end
  // time would always collide with the row being moved.
  if (!worklog.absence && !allowOverlap) {
    await assertSpanIsFree(user.id, from, to, worklogId);
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
