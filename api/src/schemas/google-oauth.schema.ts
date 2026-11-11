import { z } from 'zod';

export const googleCallbackQuerySchema = z
  .object({
    code: z.string().min(1).max(4096).optional(),
    state: z.string().min(1).max(128),
    error: z.string().min(1).max(256).optional(),
  })
  .refine((query) => query.code || query.error, {
    message: 'A code or OAuth error is required',
  });

export type GoogleCallbackQuery = z.infer<typeof googleCallbackQuerySchema>;
