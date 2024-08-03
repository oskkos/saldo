import 'server-only';

import { Settings, SettingsData } from '@/types';
import { prisma } from './prisma';
import * as Sentry from '@sentry/nextjs';
import { Settings as PrismaSettings } from '@prisma/client';
import { assertIsTime } from '@/util/assertionFunctions';
import { assertUserMatchWithSession } from './util';

const toSettings = (settings: PrismaSettings): Settings => {
  assertIsTime(settings.from_default);
  assertIsTime(settings.to_default);
  return {
    id: settings.id,
    userId: settings.user_id,
    beginDate: settings.begin_date,
    initialBalanceHours: settings.initial_balance_hours,
    initialBalanceMins: settings.initial_balance_mins,
    fromDefault: settings.from_default,
    toDefault: settings.to_default,
  };
};
export async function getSettings(userId: number): Promise<Settings | null> {
  await assertUserMatchWithSession({ id: userId });

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
      return toSettings(s);
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
): Promise<Settings> {
  await assertUserMatchWithSession({ id: userId });

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
      return toSettings(s);
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
): Promise<Settings> {
  await assertUserMatchWithSession({ id: userId });

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
      return toSettings(s);
    },
  );
}
