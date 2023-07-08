import { Worklog } from '@prisma/client';
import { prisma } from './prisma';
import { WorklogFormData } from '@/types';

export async function getWorklogs(
  userId: number,
  from: Date,
  to: Date,
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
  await prisma.worklog.create({
    data: {
      from,
      to,
      comment,
      user_id: userId,
    },
  });
}
