export interface AuthUser {
  email: string;
  name?: string;
}

export interface WorklogFormData {
  from: string;
  to: string;
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
}
export interface SaldoForDay {
  hours: number;
  minutes: number;
  toString: () => string;
  toBadge: (className?: string) => JSX.Element;
}
