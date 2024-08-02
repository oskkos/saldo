'use server';

import { AuthUser, SettingsData, WorklogFormData } from '@/types';
import { upsertUser } from '@/repository/userRepository';
import {
  insertSettings,
  upsertSettings,
} from '@/repository/settingsRepository';
import {
  deleteWorklog,
  insertWorklog,
  updateWorklog,
} from '@/repository/worklogRepository';
import { startOfDay } from '@/util/date';
import { NEW_WORKLOG_DEFAULT_FROM, NEW_WORKLOG_DEFAULT_TO } from '@/constants';
import { SignupSchema } from '@/schemas/signupSchema';

export async function onAfterSignin(user: AuthUser) {
  const u = await upsertUser(user);
  const settings = await insertSettings(u.id, {
    beginDate: startOfDay(),
    initialBalanceHours: 0,
    initialBalanceMins: 0,
    fromDefault: NEW_WORKLOG_DEFAULT_FROM,
    toDefault: NEW_WORKLOG_DEFAULT_TO,
  });
  return [u, settings] as const;
}

export async function onAfterSignup(data: unknown) {
  await Promise.resolve();

  const result = SignupSchema.safeParse(data);
  if (!result.success) {
    const errors = Object.fromEntries(
      result.error?.issues?.map((issue) => [issue.path[0], issue.message]) ||
        [],
    );
    return { status: 'error', errors: errors };
  }
  // TOOD: Implement user creation
  return {
    status: 'success',
  };
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
