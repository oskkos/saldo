import { z } from 'zod';
import type { ZodType } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

export interface SigninData {
  email: string;
  password: string;
}
export const SigninDataFields: Record<string, keyof SigninData> = {
  email: 'email',
  password: 'password',
};
export const SigninSchema: ZodType<SigninData> = z.object({
  email: z.string().email(),
  password: z.string().min(1, { message: 'Password is required' }),
});

export const signinSchemaResolver = zodResolver(SigninSchema);
