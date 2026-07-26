'use server';

import {
  AbsenceData,
  AuthUser,
  ExpectedHoursOverrideData,
  SettingsData,
  WorklogFormData,
} from '@/types';
import {
  getUser,
  getUserByEmailAndPassword,
  signupUser,
  updatePasswordByResetToken,
  upsertPasswordResetData,
  upsertUser,
} from '@/repository/userRepository';
import {
  insertSettings,
  upsertSettings,
} from '@/repository/settingsRepository';
import {
  deleteWorklog,
  insertWorklog,
  insertWorklogs,
  updateWorklog,
} from '@/repository/worklogRepository';
import { startOfDay, toDate } from '@/util/date';
import {
  DEFAULT_EXPECTED_MINUTES_PER_DAY,
  NEW_WORKLOG_DEFAULT_FROM,
  NEW_WORKLOG_DEFAULT_TO,
} from '@/constants';
import { SignupData, SignupSchema } from '@/schemas/signupSchema';
import {
  ForgotPasswordData,
  ForgotPasswordSchema,
} from '@/schemas/forgotPasswordSchema';
import { randomBytes } from 'node:crypto';
import { sendResetPasswordMail } from '@/services/forgotPasswordMailSender';
import {
  ResetPasswordData,
  ResetPasswordSchema,
} from '@/schemas/resetPasswordSchema';
import { WorklogSchema } from '@/schemas/worklogSchema';
import { AbsenceSchema } from '@/schemas/absenceSchema';
import { SettingsSchema } from '@/schemas/settingsSchema';
import { getSettings } from '@/repository/settingsRepository';
import { daysInRange } from '@/services';
import { assertExists } from '@/util/assertionFunctions';
import { ExpectedHoursOverrideSchema } from '@/schemas/expectedHoursOverrideSchema';
import {
  deleteExpectedHoursOverride,
  upsertExpectedHoursOverride,
} from '@/repository/expectedHoursOverrideRepository';
import {
  clockIn,
  clearSession,
  clockOutWithWorklog,
} from '@/repository/clockRepository';
import type { ZodType } from 'zod';

function validateOrThrow(schema: ZodType, data: unknown, fallback: string) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? fallback);
  }
}

export async function onAfterSignin(user: AuthUser) {
  const u = await upsertUser(user.email, user.name ?? '');
  const settings = await insertSettings({
    userId: u.id,
    beginDate: startOfDay(),
    initialBalanceHours: 0,
    initialBalanceMins: 0,
    fromDefault: NEW_WORKLOG_DEFAULT_FROM,
    toDefault: NEW_WORKLOG_DEFAULT_TO,
    expectedMinutesPerDay: DEFAULT_EXPECTED_MINUTES_PER_DAY,
  });
  return [u, settings] as const;
}

export async function onAfterSignup(data: SignupData) {
  const result = SignupSchema.safeParse(data);
  if (!result.success) {
    const errors = Object.fromEntries(
      result.error?.issues?.map((issue) => [issue.path[0], issue.message]) ||
        [],
    );
    return { status: 'error', errors: errors };
  }

  const parsed = result.data as SignupData;
  await signupUser({
    name: parsed.name,
    email: parsed.email,
    password: parsed.password,
  });

  return {
    status: 'success',
  };
}

export async function onWorklogSubmit(data: WorklogFormData) {
  validateOrThrow(WorklogSchema, data, 'Invalid worklog');
  const worklog = await insertWorklog(data);
  return worklog;
}

// One call for the whole range, so the days are checked together and written
// together. The stored times come from the user's own settings rather than from
// the client: only the chosen days travel over the wire.
export async function onAbsenceSubmit(data: AbsenceData) {
  validateOrThrow(AbsenceSchema, data, 'Invalid absence');
  const { from, to, reason, comment } = data;
  assertExists(from);
  assertExists(to);
  assertExists(reason);

  const settings = await getSettings();
  assertExists(settings, 'Settings not found');

  const worklogs: WorklogFormData[] = daysInRange(from, to).map((day) => ({
    from: toDate(day, settings.fromDefault),
    to: toDate(day, settings.toDefault),
    comment,
    subtractLunchBreak: true,
    absence: reason,
  }));

  return await insertWorklogs(worklogs);
}

export async function onWorklogDelete(worklogId: number) {
  await deleteWorklog(worklogId);
}

export async function onWorklogEdit(worklogId: number, data: WorklogFormData) {
  validateOrThrow(WorklogSchema, data, 'Invalid worklog');
  const worklog = await updateWorklog(worklogId, data);
  return worklog;
}

export async function onClockIn(startedAt: Date) {
  return await clockIn(startedAt);
}

export async function onClockOut(data: WorklogFormData) {
  validateOrThrow(WorklogSchema, data, 'Invalid worklog');
  await clockOutWithWorklog(data);
}

export async function onClockDiscard() {
  await clearSession();
}

export async function onSettingsUpdate(data: SettingsData) {
  validateOrThrow(SettingsSchema, data, 'Invalid settings');
  const settings = await upsertSettings(data);
  return settings;
}

export async function onExpectedHoursOverrideUpsert(
  data: ExpectedHoursOverrideData,
) {
  validateOrThrow(ExpectedHoursOverrideSchema, data, 'Invalid override');
  return await upsertExpectedHoursOverride(data);
}

export async function onExpectedHoursOverrideDelete(id: number) {
  await deleteExpectedHoursOverride(id);
}

export async function onCredentialsSignin(email: string, password: string) {
  try {
    return await getUserByEmailAndPassword(email, password);
  } catch (e) {
    return null;
  }
}

export async function onForgotPassword(data: ForgotPasswordData) {
  const result = ForgotPasswordSchema.safeParse(data);
  if (!result.success) {
    const errors = Object.fromEntries(
      result.error?.issues?.map((issue) => [issue.path[0], issue.message]) ||
        [],
    );
    return { status: 'error', errors: errors };
  }
  const email = (result.data as ForgotPasswordData).email;
  const user = await getUser(email);

  if (!user) {
    console.log(
      `Tried to reset password with email <${email}> but user not found`,
    );
    return {
      status: 'success',
    };
  }

  const token = randomBytes(32).toString('hex');
  await upsertPasswordResetData(user.id, token);
  await sendResetPasswordMail(email, token);

  return {
    status: 'success',
  };
}

export async function onResetPassword(data: ResetPasswordData) {
  const result = ResetPasswordSchema.safeParse(data);
  if (!result.success) {
    const errors = Object.fromEntries(
      result.error?.issues?.map((issue) => [issue.path[0], issue.message]) ||
        [],
    );
    return { status: 'error', errors: errors };
  }
  const token = data.token;
  await updatePasswordByResetToken(token, data.password);

  return {
    status: 'success',
  };
}
