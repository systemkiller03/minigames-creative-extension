import { z } from 'zod';

const emailSchema = z.email().trim().toLowerCase();

export const emailVerificationRequestSchema = z.object({
  email: emailSchema,
});

export const emailVerificationConfirmSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{8}$/),
});

export type EmailVerificationRequest = z.infer<typeof emailVerificationRequestSchema>;
export type EmailVerificationConfirm = z.infer<typeof emailVerificationConfirmSchema>;
