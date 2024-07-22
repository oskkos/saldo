import { AuthUser } from '@/types';
import { prisma } from './prisma';
import * as Sentry from '@sentry/nextjs';

export async function upsertUser({ email, name }: AuthUser) {
  return await Sentry.startSpan(
    { name: 'upsertUser', op: 'db.sql.prisma' },
    async () => {
      const user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          name,
        },
        update: { name },
      });
      return user;
    },
  );
}

export async function getUser(email: string) {
  return await Sentry.startSpan(
    { name: 'getUser', op: 'db.sql.prisma' },
    async () => {
      const user = await prisma.user.findUnique({
        where: { email },
      });
      return user;
    },
  );
}
