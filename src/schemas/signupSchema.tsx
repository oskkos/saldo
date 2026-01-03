import { z } from 'zod';
import type { ZodType } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

export interface SignupData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}
export const SignupDataFields: Record<string, keyof SignupData> = {
  name: 'name',
  email: 'email',
  password: 'password',
  confirmPassword: 'confirmPassword',
};
export const SignupSchema = z
  .object({
    email: z.email(),
    name: z.string().min(1, {
      error: 'Name is required',
    }),
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

export const signupSchemaResolver = zodResolver(SignupSchema);
