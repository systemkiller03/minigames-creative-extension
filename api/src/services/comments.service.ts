import { NotFoundException } from '@/errors/http-exceptions';
import { usersRepository } from '@/repositories/users.repository';
import type { CommentsQuery } from '@/schemas/catalog.schema';
import { cached } from '@/services/cache.service';
import { upstream } from '@/services/upstream.client';
import { upstreamEmailFor } from '@/utils/upstream-email';

const COMMENTS_TTL = 15;

type Envelope<T> = { data: T; meta?: Record<string, unknown> };
type Comment = { commentId: string; [field: string]: unknown };
type LikeResult = { isLikedByCurrentUser: boolean; likesCount: number };

export class CommentsService {
  /**
   * Anonymous reads share one cached copy. A signed-in read goes straight to the upstream
   * with the user's synthetic email, so `isLikedByCurrentUser` is right and nothing
   * per-user is ever cached.
   */
  list(slug: string, query: CommentsQuery, userId?: string) {
    const path = `/api/games/${encodeURIComponent(slug)}/comments`;
    const params = { limit: query.limit, sort: query.sort };
    if (userId) {
      return upstream.get<Envelope<Comment[]>>(path, {
        ...params,
        userEmail: upstreamEmailFor(userId),
      });
    }
    return cached('comments', { slug, ...params }, COMMENTS_TTL, () =>
      upstream.get<Envelope<Comment[]>>(path, params),
    );
  }

  /** The author name is always the account's own name, never client supplied. */
  async create(userId: string, slug: string, text: string) {
    const user = await usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return upstream.post<Envelope<Comment>>(`/api/games/${encodeURIComponent(slug)}/comments`, {
      userEmail: upstreamEmailFor(userId),
      authorName: user.name,
      text,
    });
  }

  /** A toggle, like upstream: the response says which state the user is now in. */
  toggleLike(userId: string, commentId: string) {
    return upstream.post<Envelope<LikeResult>>(`/api/comments/${commentId}/like`, {
      userEmail: upstreamEmailFor(userId),
    });
  }
}

export const commentsService = new CommentsService();
