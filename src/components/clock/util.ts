import { toISODay } from '@/util/dateFormatter';

// A work session may not span more than one calendar day. The finalize sheet
// fixes the worklog day to the clock-in day, so a session whose end falls on a
// different day must be corrected before it can be saved.
export function crossesMidnight(startedAt: Date, endedAt: Date): boolean {
  return toISODay(startedAt) !== toISODay(endedAt);
}
