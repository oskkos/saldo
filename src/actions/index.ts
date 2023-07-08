'use server';

import { AuthUser, WorklogFormData } from '@/types';
import { upsertUser } from '@/repository/userRepository';
import { insertWorklog } from '@/repository/worklogRepository';

export async function onAfterSignin(user: AuthUser) {
  await upsertUser(user);
}

export async function onWorklogSubmit(userId: number, data: WorklogFormData) {
  await insertWorklog(userId, data);
}
