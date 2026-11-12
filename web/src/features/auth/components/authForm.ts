import { z } from 'zod';
import { ApiError } from '@/shared/api/client';

export const emailSchema = z.email('Enter a valid email address').trim();
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters');
export const codeSchema = z.string().regex(/^\d{8}$/u, 'Enter the 8-digit code');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Use at least 2 characters')
      .max(30, 'Use at most 30 characters'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

/** First validation message of a TanStack Form field, shown once the field was touched or submitted. */
export function fieldError(
  errors: ReadonlyArray<unknown>,
  shouldShow: boolean,
): string | undefined {
  if (!shouldShow) {
    return undefined;
  }
  for (const error of errors) {
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
  }
  return undefined;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return error.retryAfter
        ? `Too many attempts. Try again in ${error.retryAfter} seconds.`
        : 'Too many attempts. Please try again later.';
    }
    if (error.status >= 400 && error.status < 500) {
      return error.message;
    }
  }
  return fallback;
}
