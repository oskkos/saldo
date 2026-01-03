import { z } from 'zod';
import type { ZodType } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

export interface ResetPasswordData {
  token: string;
  password: string;
  confirmPassword: string;
}
export const ResetPasswordDataFields: Record<string, keyof ResetPasswordData> =
  {
    token: 'token',
    password: 'password',
    confirmPassword: 'confirmPassword',
  };
export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8, {
        error: 'Password is too short',
      })
      .max(20, {
        error: 'Password is too long',
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'], // path of error
    error: 'Passwords do not match',
  });

export const resetPasswordSchemaResolver = zodResolver(ResetPasswordSchema);
