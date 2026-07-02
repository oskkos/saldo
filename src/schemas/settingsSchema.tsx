import { z } from 'zod';
import { timeIsGt } from '@/util/date';
import type { Date_Time } from '@/util/dateFormatter';

const timeString = z.string().regex(/^\d{2}:\d{2}$/, {
  error: 'Invalid time format',
});

export const SettingsSchema = z
  .object({
    beginDate: z.date({ error: 'Begin date is required' }),
    // Hours may be negative (starting in deficit); minutes are 0-59.
    initialBalanceHours: z
      .number()
      .int({ error: 'Hours must be a whole number' })
      .min(-10000, { error: 'Hours out of range' })
      .max(10000, { error: 'Hours out of range' }),
    initialBalanceMins: z
      .number()
      .int({ error: 'Minutes must be a whole number' })
      .min(0, { error: 'Minutes must be between 0 and 59' })
      .max(59, { error: 'Minutes must be between 0 and 59' }),
    fromDefault: timeString,
    toDefault: timeString,
    expectedMinutesPerDay: z
      .number()
      .int({ error: 'Expected minutes must be a whole number' })
      .min(0, { error: 'Expected hours must be between 0 and 24' })
      .max(24 * 60, { error: 'Expected hours must be between 0 and 24' }),
  })
  .refine(
    (data) =>
      timeIsGt(data.toDefault as Date_Time, data.fromDefault as Date_Time),
    {
      error: 'From time must be before to time',
      path: ['toDefault'],
    },
  );
