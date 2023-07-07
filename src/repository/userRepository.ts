import { AuthUser } from '@/types/user';
import { prisma } from './prisma';

export async function upsertUser({ email, name }: AuthUser) {
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
    },
    update: { name },
  });
  console.log(user);
}

export async function getUser(email: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
  });
  return user;
}
