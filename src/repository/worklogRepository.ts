import { Worklog } from '@prisma/client';
import { prisma } from './prisma';
import { WorklogFormData } from '@/types';
import * as Sentry from '@sentry/nextjs';

export async function getWorklogs(
  userId: number,
  from?: Date,
  to?: Date,
): Promise<Worklog[]> {
  return await Sentry.startSpan(
    { name: 'getWorklogs', op: 'db.sql.prisma' },
    async (span) => {
      const worklogs = await prisma.worklog.findMany({
        where: {
          user_id: userId,
          from: { gte: from },
          to: { lte: to },
        },
      });

      span.setAttributes({
        userId,
        from: from?.toISOString() ?? 'beginning',
        to: to?.toISOString() ?? 'end',
        records: worklogs.length,
      });

      return worklogs;
    },
  );
}

export async function insertWorklog(
  userId: number,
  { from, to, comment, subtractLunchBreak, absence }: WorklogFormData,
) {
  return await Sentry.startSpan(
    { name: 'insertWorklog', op: 'db.sql.prisma' },
    async () => {
      const worklog = await prisma.worklog.create({
        data: {
          from,
          to,
          comment,
          user_id: userId,
          subtract_lunch_break: subtractLunchBreak,
          absence,
        },
      });
      return worklog;
    },
  );
}

export async function updateWorklog(
  worklogId: number,
  { from, to, comment, subtractLunchBreak }: WorklogFormData,
) {
  return await Sentry.startSpan(
    { name: 'updatetWorklog', op: 'db.sql.prisma' },
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
      return worklog;
    },
  );
}

export async function deleteWorklog(worklogId: number) {
  return await Sentry.startSpan(
    { name: 'deleteWorklog', op: 'db.sql.prisma' },
    async () => {
      await prisma.worklog.delete({
        where: { id: worklogId },
      });
    },
  );
}
