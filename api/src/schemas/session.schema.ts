import { z } from 'zod';

export const sessionParamsSchema = z.object({
  sessionId: z.uuid(),
});
