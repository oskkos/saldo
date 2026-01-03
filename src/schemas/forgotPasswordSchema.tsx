import { z } from 'zod';
import type { ZodType } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

export interface ForgotPasswordData {
  email: string;
}
export const ForgotPasswordDataFields: Record<
  string,
  keyof ForgotPasswordData
> = {
  email: 'email',
};
export const ForgotPasswordSchema = z.object({
  email: z.email(),
});

export const forgotPasswordSchemaResolver = zodResolver(ForgotPasswordSchema);
