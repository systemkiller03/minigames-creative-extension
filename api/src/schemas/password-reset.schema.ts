import { z } from 'zod';
import { passwordSchema } from '@/schemas/register.schema';

const emailSchema = z.email().trim().toLowerCase();

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetVerifySchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{8}$/),
});

export const passwordResetConfirmSchema = z.object({
  email: emailSchema,
  resetToken: z.string().min(32).max(128),
  newPassword: passwordSchema,
});

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetVerify = z.infer<typeof passwordResetVerifySchema>;
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;
