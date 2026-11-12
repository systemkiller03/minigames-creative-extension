import { z } from 'zod';
import { passwordSchema } from '@/schemas/register.schema';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(30),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .refine((body) => body.currentPassword !== body.newPassword, {
    path: ['newPassword'],
    message: 'New password must differ from the current one',
  });

export const deleteAccountSchema = z.object({
  /** Required when the account has a password; Google-only accounts have none. */
  password: z.string().min(1).max(128).optional(),
  confirm: z.literal(true),
});

export type DeleteAccountBody = z.infer<typeof deleteAccountSchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
