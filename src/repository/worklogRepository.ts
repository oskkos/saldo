import 'server-only';

import { prisma } from './prisma';
import { Worklog as PrismaWorklog } from '@prisma/client';
import { Worklog, WorklogFormData } from '@/types';
import { assertIsAbsenceReason } from '@/util/assertionFunctions';
import * as Sentry from '@sentry/nextjs';
import { getUserFromSession } from '@/auth/authSession';

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

export async function getWorklogs(from?: Date, to?: Date): Promise<Worklog[]> {
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
