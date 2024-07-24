import { SettingsData } from '@/types';
import { prisma } from './prisma';
import * as Sentry from '@sentry/nextjs';
import { Settings as S } from '@prisma/client';
import { Date_Time } from '@/util/dateFormatter';
import { assertIsTime } from '@/util/assertionFunctions';

export interface Settings extends S {
  from_default: Date_Time;
  to_default: Date_Time;
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
      if (!s) {
        return null;
      }
      assertIsTime(s.from_default);
      assertIsTime(s.to_default);
      return s as Settings;
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
      assertIsTime(s.from_default);
      assertIsTime(s.to_default);
      return s as Settings;
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
      assertIsTime(s.from_default);
      assertIsTime(s.to_default);
      return s as Settings;
    },
  );
}
