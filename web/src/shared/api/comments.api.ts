import { z } from 'zod';
import { apiRequest } from './client';

export const COMMENT_MAX_LENGTH = 500;

const commentSchema = z.object({
  commentId: z.string().min(1),
  authorName: z.string(),
  text: z.string(),
  likesCount: z.coerce.number().int().nonnegative(),
  isLikedByCurrentUser: z.boolean().optional().default(false),
  createdAt: z.string().optional(),
});

const commentsResponseSchema = z.object({
  data: z.array(commentSchema),
  meta: z.object({ totalComments: z.coerce.number().int().nonnegative().optional() }).optional(),
});

const likeStateSchema = z.object({
  data: z.object({
    isLikedByCurrentUser: z.boolean(),
    likesCount: z.coerce.number().int().nonnegative(),
  }),
});

export type Comment = z.infer<typeof commentSchema>;
export type CommentsList = { comments: Comment[]; total: number };
export type CommentLikeState = z.infer<typeof likeStateSchema>['data'];

export async function getComments(
  slug: string,
  signal?: AbortSignal,
  limit = 50,
): Promise<CommentsList> {
  const response = await apiRequest<unknown>(
    `/catalog/games/${encodeURIComponent(slug)}/comments?sort=newest&limit=${limit}`,
    { signal },
  );
  const parsed = commentsResponseSchema.parse(response);
  return { comments: parsed.data, total: parsed.meta?.totalComments ?? parsed.data.length };
}

export async function postComment(slug: string, text: string): Promise<Comment> {
  const response = await apiRequest<unknown>(
    `/catalog/games/${encodeURIComponent(slug)}/comments`,
    { method: 'POST', body: { text } },
  );
  return z.object({ data: commentSchema }).parse(response).data;
}

export async function toggleCommentLike(commentId: string): Promise<CommentLikeState> {
  const response = await apiRequest<unknown>(
    `/catalog/comments/${encodeURIComponent(commentId)}/like`,
    { method: 'POST' },
  );
  return likeStateSchema.parse(response).data;
}
