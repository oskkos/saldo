import { z } from 'zod';

export const ExpectedHoursOverrideSchema = z.object({
  date: z.date({ error: 'Date is required' }),
  minutes: z
    .number()
    .int({ error: 'Minutes must be a whole number' })
    .min(0, { error: 'Expected hours must be between 0 and 24' })
    .max(24 * 60, { error: 'Expected hours must be between 0 and 24' }),
  label: z
    .string()
    .max(100, { error: 'Label is too long (max 100 characters)' })
    .optional(),
});
