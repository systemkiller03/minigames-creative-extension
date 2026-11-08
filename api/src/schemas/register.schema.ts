import { z } from 'zod';

export const registerSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(2).max(30),
});

export type RegisterBody = z.infer<typeof registerSchema>;
