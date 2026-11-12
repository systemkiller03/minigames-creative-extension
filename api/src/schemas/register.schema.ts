import { z } from 'zod';

export const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: passwordSchema,
  name: z.string().trim().min(2).max(30),
});

export type RegisterBody = z.infer<typeof registerSchema>;
