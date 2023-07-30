import { AbsenceReason } from '@/types';
import { Date_ISODay, Date_Time, Date_YearAndMonth } from './dateFormatter';

export function assertExists<T>(
  val: T | null | undefined,
  errMsg?: string,
): asserts val is T {
  if (typeof val === 'undefined') {
    throw new Error(errMsg ?? 'Value was not defined');
  }
  if (val === null) {
    throw new Error(errMsg ?? 'Value was null');
  }
}
export function assertIsAbsenceReason(
  val: string,
): asserts val is AbsenceReason {
  if (!Object.keys(AbsenceReason).find((k) => k === val)) {
    throw new Error('Not a valid absence reason: ' + String(val));
  }
}
export function assertIsISODay(
  val: string,
  errMsg?: string,
): asserts val is Date_ISODay {
  if (!val.match(/^(\d{4})-(\d{2})-(\d{2})$/)) {
    throw new Error(errMsg ?? 'Not a valid ISO day: ' + String(val));
  }
}
export function assertIsTime(
  val: string,
  errMsg?: string,
): asserts val is Date_Time {
  if (!val.match(/^(\d{2}):(\d{2})$/)) {
    throw new Error(errMsg ?? 'Not a valid Time: ' + String(val));
  }
}
export function assertIsYearAndMonth(
  val: string,
  errMsg?: string,
): asserts val is Date_YearAndMonth {
  if (!val.match(/^(\d{4})-(\d{2})$/)) {
    throw new Error(errMsg ?? 'Not a valid YearAndMonth: ' + String(val));
  }
}
