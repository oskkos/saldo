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
export const ResetPasswordSchema: ZodType<ResetPasswordData> = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8, { message: 'Password is too short' })
      .max(20, { message: 'Password is too long' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'], // path of error
  });

export const resetPasswordSchemaResolver = zodResolver(ResetPasswordSchema);
