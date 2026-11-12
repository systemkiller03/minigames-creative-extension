import { favouritesRepository } from '@/repositories/favourites.repository';
import { invalidate } from '@/services/cache.service';
import { catalogService } from '@/services/catalog.service';
import { upstream } from '@/services/upstream.client';
import { upstreamEmailFor } from '@/utils/upstream-email';

type ToggleResult = { data: { gameSlug: string; isFavorited: boolean; likesCount: number } };

export class FavouritesService {
  /**
   * Idempotent set. The upstream only has a toggle, so it is called only when our own
   * state changes, and a failed call undoes the local change so the two never drift.
   */
  async setFavourite(userId: string, slug: string, desired: boolean) {
    const game = await catalogService.getGame(slug); // 404 for unknown games

    const changed = desired
      ? await favouritesRepository.add(userId, slug)
      : await favouritesRepository.remove(userId, slug);
    if (!changed) {
      return { gameSlug: slug, isFavorited: desired, likesCount: game.data.likesCount };
    }

    try {
      let result = await this.toggleUpstream(userId, slug);
      if (result.data.isFavorited !== desired) {
        // The upstream already held the opposite state (drift): toggle once more to match.
        result = await this.toggleUpstream(userId, slug);
      }
      await invalidate('game', { slug });
      return {
        gameSlug: slug,
        isFavorited: desired,
        likesCount: result.data.likesCount,
      };
    } catch (error) {
      await (
        desired ? favouritesRepository.remove(userId, slug) : favouritesRepository.add(userId, slug)
      ).catch((revertError: unknown) => console.error('Favourite revert failed', revertError));
      throw error;
    }
  }

  /** The user's favourites as game summaries, newest first. Games no longer listed are skipped. */
  async list(userId: string) {
    const slugs = await favouritesRepository.slugsFor(userId);
    if (slugs.length === 0) return { data: [], meta: { totalItems: 0 } };

    const games = new Map((await catalogService.listAllGames()).map((game) => [game.slug, game]));
    const data = slugs.flatMap((slug) => {
      const game = games.get(slug);
      return game ? [{ ...game, isFavorited: true }] : [];
    });
    return { data, meta: { totalItems: data.length } };
  }

  /** Before an account is deleted: take its likes off the upstream. Best effort. */
  async releaseUpstream(userId: string) {
    const slugs = await favouritesRepository.slugsFor(userId);
    for (const slug of slugs) {
      try {
        await this.toggleUpstream(userId, slug);
        await invalidate('game', { slug });
      } catch (error) {
        console.error(`Could not remove upstream favourite ${slug} for a deleted account`, error);
      }
    }
  }

  private toggleUpstream(userId: string, slug: string) {
    return upstream.post<ToggleResult>(`/api/games/${encodeURIComponent(slug)}/favorite`, {
      userEmail: upstreamEmailFor(userId),
    });
  }
}

export const favouritesService = new FavouritesService();
