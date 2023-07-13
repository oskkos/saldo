import { Worklog } from '@prisma/client';
import { prisma } from './prisma';
import { WorklogFormData } from '@/types';

export async function getWorklogs(
  userId: number,
  from?: Date,
  to?: Date,
): Promise<Worklog[]> {
  return await prisma.worklog.findMany({
    where: {
      user_id: userId,
      from: { gte: from },
      to: { lte: to },
    },
  });
}

export async function insertWorklog(
  userId: number,
  { from, to, comment }: WorklogFormData,
) {
  const worklog = await prisma.worklog.create({
    data: {
      from,
      to,
      comment,
      user_id: userId,
    },
  });
  return worklog;
}

export async function updateWorklog(
  worklogId: number,
  { from, to, comment }: WorklogFormData,
) {
  const worklog = await prisma.worklog.update({
    where: { id: worklogId },
    data: {
      from,
      to,
      comment,
    },
  });
  return worklog;
}

export async function deleteWorklog(worklogId: number) {
  await prisma.worklog.delete({
    where: { id: worklogId },
  });
}
