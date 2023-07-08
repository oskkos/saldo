import { Worklog } from '@prisma/client';
import { prisma } from './prisma';

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