import { AuthUser } from '@/types';
import { prisma } from './prisma';

export async function upsertUser({ email, name }: AuthUser) {
  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
    },
    update: { name },
  });
}

export async function getUser(email: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
  });
  return user;
}
