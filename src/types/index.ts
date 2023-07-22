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
export interface SaldoForDay {
  hours: number;
  minutes: number;
  toString: () => string;
  toBadge: (className?: string) => JSX.Element;
}
