import { AuthUser, SettingsData } from '@/types';
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
  return user;
}

export async function getUser(email: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
  });
  return user;
}
export async function getSettings(userId: number) {
  const s = await prisma.settings.findUnique({
    where: {
      user_id: userId,
    },
  });
  return s;
}
export async function insertSettings(
  userId: number,
  beginDate: Date,
  initialBalanceHours: number,
  initialBalanceMins: number,
) {
  const s = await prisma.settings.create({
    data: {
      user_id: userId,
      begin_date: beginDate,
      initial_balance_hours: initialBalanceHours,
      initial_balance_mins: initialBalanceMins,
    },
  });
  return s;
}
export async function upsertSettings(
  userId: number,
  { beginDate, initialBalanceHours, initialBalanceMins }: SettingsData,
) {
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
}
