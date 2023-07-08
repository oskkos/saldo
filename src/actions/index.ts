'use server';

import { AuthUser, WorklogFormData } from '@/types';
import { upsertUser } from '@/repository/userRepository';
import { getWorklogs, insertWorklog } from '@/repository/worklogRepository';
import { endOfDay, startOfDay } from '@/util/date';

export async function onAfterSignin(user: AuthUser) {
  await upsertUser(user);
}

export async function onWorklogSubmit(userId: number, data: WorklogFormData) {
  await insertWorklog(userId, data);
  return getWorklogs(userId, startOfDay(data.from), endOfDay(data.from));
}
