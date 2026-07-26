import { z } from 'zod';
import { AbsenceReason } from '@/types';

export const AbsenceSchema = z
  .object({
    from: z.date({ error: 'From date is required' }),
    to: z.date({ error: 'To date is required' }),
    reason: z.enum(AbsenceReason, { error: 'Reason is required' }),
    comment: z.string().max(1000, {
      error: 'Comment is too long (max 1000 characters)',
    }),
  })
  .refine((data) => data.to.getTime() >= data.from.getTime(), {
    error: 'The to-date must not be before the from-date',
    path: ['to'],
  });
