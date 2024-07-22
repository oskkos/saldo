import { AuthUser, SettingsData } from '@/types';
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
export async function getSettings(userId: number) {
  return await Sentry.startSpan(
    { name: 'getSettings', op: 'db.sql.prisma' },
    async () => {
      const s = await prisma.settings.findUnique({
        where: {
          user_id: userId,
        },
      });
      return s;
    },
  );
}
export async function insertSettings(
  userId: number,
  beginDate: Date,
  initialBalanceHours: number,
  initialBalanceMins: number,
) {
  return await Sentry.startSpan(
    { name: 'insertSettings', op: 'db.sql.prisma' },
    async () => {
      const s = await prisma.settings.upsert({
        where: {
          user_id: userId,
        },
        create: {
          user_id: userId,
          begin_date: beginDate,
          initial_balance_hours: initialBalanceHours,
          initial_balance_mins: initialBalanceMins,
        },
        update: {},
      });
      return s;
    },
  );
}
export async function upsertSettings(
  userId: number,
  { beginDate, initialBalanceHours, initialBalanceMins }: SettingsData,
) {
  return await Sentry.startSpan(
    { name: 'upsertSettings', op: 'db.sql.prisma' },
    async () => {
      const s = await prisma.settings.upsert({
        where: {
          user_id: userId,
        },
        create: {
          user_id: userId,
          begin_date: beginDate,
          initial_balance_hours: initialBalanceHours,
          initial_balance_mins: initialBalanceMins,
        },
        update: {
          begin_date: beginDate,
          initial_balance_hours: initialBalanceHours,
          initial_balance_mins: initialBalanceMins,
        },
      });
      return s;
    },
  );
}
