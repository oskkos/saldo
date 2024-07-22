import { SettingsData } from '@/types';
import { prisma } from './prisma';
import * as Sentry from '@sentry/nextjs';

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
  {
    beginDate,
    initialBalanceHours,
    initialBalanceMins,
    fromDefault,
    toDefault,
  }: SettingsData,
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
          from_default: fromDefault,
          to_default: toDefault,
        },
        update: {},
      });
      return s;
    },
  );
}
export async function upsertSettings(
  userId: number,
  {
    beginDate,
    initialBalanceHours,
    initialBalanceMins,
    fromDefault,
    toDefault,
  }: SettingsData,
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
          from_default: fromDefault,
          to_default: toDefault,
        },
        update: {
          begin_date: beginDate,
          initial_balance_hours: initialBalanceHours,
          initial_balance_mins: initialBalanceMins,
          from_default: fromDefault,
          to_default: toDefault,
        },
      });
      return s;
    },
  );
}
