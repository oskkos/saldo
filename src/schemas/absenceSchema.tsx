import { z } from 'zod';
import { AbsenceReason } from '@/types';

// A range is a pair of days, not of instants: the times the records are stored
// with come from the user's settings, and whatever time of day the picked dates
// happen to carry is discarded. Comparing the instants would reject a same-day
// range whose ends were built in the wrong order.
function utcDayNumber(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The date picker accepts any year, and the range is expanded into one record
// per day: without a ceiling a careless pair of dates turns into tens of
// thousands of rows in a single write.
const MAX_ABSENCE_DAYS = 366;

export const AbsenceSchema = z
  .object({
    from: z.date({ error: 'From date is required' }),
    to: z.date({ error: 'To date is required' }),
    reason: z.enum(AbsenceReason, { error: 'Reason is required' }),
    comment: z.string().max(1000, {
      error: 'Comment is too long (max 1000 characters)',
    }),
  })
  .refine((data) => utcDayNumber(data.to) >= utcDayNumber(data.from), {
    error: 'The to-date must not be before the from-date',
    path: ['to'],
  })
  .refine(
    (data) =>
      (utcDayNumber(data.to) - utcDayNumber(data.from)) / DAY_MS + 1 <=
      MAX_ABSENCE_DAYS,
    {
      error: `An absence range cannot be longer than ${MAX_ABSENCE_DAYS} days`,
      path: ['to'],
    },
  );
