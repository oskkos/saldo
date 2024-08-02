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
export const SignupSchema: ZodType<SignupData> = z
  .object({
    email: z.string().email(),
    name: z.string().min(1, { message: 'Name is required' }),
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

export const signupSchemaResolver = zodResolver(SignupSchema);
