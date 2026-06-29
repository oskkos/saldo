import { WorklogFormData, WorklogFormDataEntry } from '@/types';
import { toDate } from '@/util/date';
import { assertIsISODay, assertIsTime } from '@/util/assertionFunctions';

// Convert the form-entry shape (day + time strings) into the domain WorklogFormData
// (Date from/to). Throws via the assertions if any field is malformed.
export function toWorklogFormData(
  value: WorklogFormDataEntry,
): WorklogFormData {
  assertIsISODay(value.day, 'Invalid day');
  assertIsTime(value.from, 'Invalid from time');
  assertIsTime(value.to, 'Invalid to time');
  return {
    from: toDate(value.day, value.from),
    to: toDate(value.day, value.to),
    comment: value.comment,
    subtractLunchBreak: value.subtractLunchBreak,
  };
}
