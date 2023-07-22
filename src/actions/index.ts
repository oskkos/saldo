'use server';

import { AuthUser, SettingsData, WorklogFormData } from '@/types';
import {
  getSettings,
  insertSettings,
  upsertSettings,
  upsertUser,
} from '@/repository/userRepository';
import {
  deleteWorklog,
  insertWorklog,
  updateWorklog,
} from '@/repository/worklogRepository';
import { startOfDay } from '@/util/date';

export async function onAfterSignin(user: AuthUser) {
  const u = await upsertUser(user);
  const settings = await getSettings(u.id);
  if (!settings) {
    await insertSettings(u.id, startOfDay(), 0, 0);
  }
}

export async function onWorklogSubmit(userId: number, data: WorklogFormData) {
  const worklog = await insertWorklog(userId, data);
  return worklog;
}

export async function onWorklogDelete(worklogId: number) {
  await deleteWorklog(worklogId);
}

export async function onWorklogEdit(worklogId: number, data: WorklogFormData) {
  const worklog = await updateWorklog(worklogId, data);
  return worklog;
}

export async function onSettingsUpdate(userId: number, data: SettingsData) {
  const settings = await upsertSettings(userId, data);
  return settings;
}
