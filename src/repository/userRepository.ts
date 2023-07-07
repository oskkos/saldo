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
