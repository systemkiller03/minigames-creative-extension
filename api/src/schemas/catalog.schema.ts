import { z } from 'zod';

export const gamesQuerySchema = z.object({
  featured: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,32}$/)
    .default('all'),
  sort: z.enum(['rating-desc', 'rating-asc', 'name-asc', 'name-desc']).default('rating-desc'),
});

export const gameParamsSchema = z.object({
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
});

export type GamesQuery = z.infer<typeof gamesQuerySchema>;

export const commentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export const createCommentSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export const commentParamsSchema = z.object({
  commentId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
});

export type CommentsQuery = z.infer<typeof commentsQuerySchema>;
