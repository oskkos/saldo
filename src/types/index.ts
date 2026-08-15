import { Date_ISODay, Date_Time } from '@/util/dateFormatter';

export interface AuthUser {
  email: string;
  name?: string;
}

export interface WorklogFormDataEntry {
  day: Date_ISODay | '';
  comment: string;
  from: Date_Time | '';
  to: Date_Time | '';
  subtractLunchBreak: boolean;
}
export interface WorklogFormData {
  from: Date;
  to: Date;
  comment: string;
  subtractLunchBreak: boolean;
  absence?: AbsenceReason;
}

export interface SettingsData {
  beginDate: Date;
  initialBalanceHours: number;
  initialBalanceMins: number;
  fromDefault: Date_Time;
  toDefault: Date_Time;
  expectedMinutesPerDay: number;
}

export interface ExpectedHoursOverride {
  id: number;
  date: Date;
  minutes: number;
  label: string | null;
}
export interface ExpectedHoursOverrideData {
  date: Date;
  minutes: number;
  label?: string;
}

export enum AbsenceReason {
  'holiday' = 'holiday',
  'flex_hours' = 'flex_hours',
  'sick_leave' = 'sick_leave',
  'other' = 'other',
}
export interface AbsenceData {
  from: Date | null;
  to: Date | null;
  reason?: AbsenceReason;
  comment: string;
}

// A rejected absence is an expected outcome carrying a message written for the
// user, so it is returned rather than thrown: Next redacts anything raised out
// of a server action in a production build, leaving only an opaque digest.
export type AbsenceSubmitResult =
  | { status: 'success'; worklogs: Worklog[] }
  | { status: 'error'; message: string };

// The span of a stored entry an incoming one would land on top of.
export type WorklogConflict = { from: Date; to: Date };

// Worklog writes report their outcome the same way, and for the same reason. A
// conflict is distinct from an error: it is a question the user answers, and
// answering yes re-runs the write with `allowOverlap`.
export type WorklogSubmitResult =
  | { status: 'success'; worklog: Worklog }
  | { status: 'conflict'; message: string; conflicts: WorklogConflict[] }
  | { status: 'error'; message: string };

// Clock-out creates a worklog but hands back nothing to render, so success
// carries only whether this call was the one that finalized the session —
// `false` means it had already been closed and nothing further was written.
export type ClockOutResult =
  | { status: 'success'; finalized: boolean }
  | { status: 'conflict'; message: string; conflicts: WorklogConflict[] }
  | { status: 'error'; message: string };
import type { ReactElement } from 'react';

export interface SaldoForDay {
  hours: number;
  minutes: number;
  toString: () => string;
  toBadge: (className?: string) => ReactElement;
}
export interface Worklog {
  id: number;
  from: Date;
  to: Date;
  subtractLunchBreak: boolean;
  absence: AbsenceReason | null;
  comment: string | null;
}
export interface Settings {
  id: number;
  beginDate: Date;
  initialBalanceHours: number;
  initialBalanceMins: number;
  fromDefault: Date_Time;
  toDefault: Date_Time;
  expectedMinutesPerDay: number;
}
export interface User {
  id: number;
  email: string;
  name: string | null;
}

export interface ActiveSession {
  startedAt: Date;
}
