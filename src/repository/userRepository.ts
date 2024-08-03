import 'server-only';

import { AuthUser, User } from '@/types';
import { User as PrismaUser } from '@prisma/client';
import { prisma } from './prisma';
import * as Sentry from '@sentry/nextjs';
import bcrypt from 'bcrypt';
import { assertUserMatchWithSession } from './util';

const toUser = (user: PrismaUser): User => ({
  id: user.id,
  email: user.email,
  name: user.name,
});

export async function upsertUser({ email, name }: AuthUser): Promise<User> {
  await assertUserMatchWithSession({ email });

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
      return toUser(user);
    },
  );
}

export async function getUser(email: string): Promise<User | null> {
  return await Sentry.startSpan(
    { name: 'getUser', op: 'db.sql.prisma' },
    async () => {
      const user = await prisma.user.findUnique({
        where: { email },
      });
      return user ? toUser(user) : null;
    },
  );
}

export async function signupUser({
  email,
  name,
  password,
}: AuthUser & { password: string }): Promise<User> {
  if (await getUser(email)) {
    throw new Error('User already exists.');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  return await Sentry.startSpan(
    { name: 'signupUser', op: 'db.sql.prisma' },
    async () => {
      const user = await prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
        },
      });
      return toUser(user);
    },
  );
}

export async function getUserByEmailAndPassword(
  email: string,
  password: string,
): Promise<User | null> {
  return await Sentry.startSpan(
    { name: 'getUserByEmailAndPassword', op: 'db.sql.prisma' },
    async () => {
      const user = await prisma.user.findUnique({
        where: { email },
      });
      if (!user) {
        return null;
      }
      if (!password || !user.password) {
        return null;
      }
      if (await bcrypt.compare(password, String(user.password))) {
        return toUser(user);
      }
      throw new Error('Invalid password');
    },
  );
}
