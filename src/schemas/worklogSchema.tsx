import { z } from 'zod';
import { AbsenceReason } from '@/types';

// from/to are wall-clock-as-UTC instants (see util/date toDate), so "same day"
// is a same-UTC-date comparison — timezone-independent and not reliant on the
// local-timezone behavior of toISODay.
function isSameUtcDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export const WorklogSchema = z
  .object({
    from: z.date({ error: 'Start time is required' }),
    to: z.date({ error: 'End time is required' }),
    comment: z.string().max(1000, {
      error: 'Comment is too long (max 1000 characters)',
    }),
    subtractLunchBreak: z.boolean(),
    absence: z.enum(AbsenceReason).optional(),
  })
  .refine((data) => data.to.getTime() > data.from.getTime(), {
    error: 'End time must be after start time',
    path: ['to'],
  })
  .refine((data) => isSameUtcDay(data.from, data.to), {
    error: 'A worklog must start and end on the same day',
    path: ['to'],
  });
