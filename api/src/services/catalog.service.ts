import { favouritesRepository } from '@/repositories/favourites.repository';
import type { GamesQuery } from '@/schemas/catalog.schema';
import { cached } from '@/services/cache.service';
import { upstream } from '@/services/upstream.client';

const CATEGORIES_TTL = 10 * 60;
const LIVE_TTL = 60;
const ALL_GAMES_TTL = 5 * 60;
const MAX_PAGES = 20;

export type GameSummary = {
  slug: string;
  name: string;
  category: string;
  price: string;
  shortDescription: string;
  rating: number;
  likesCount: number;
  cardImage: string;
};

export type GameDetails = {
  slug: string;
  likesCount: number;
  isLikedByCurrentUser: boolean;
  [field: string]: unknown;
};

type Envelope<T> = { data: T; meta?: Record<string, unknown> };

export class CatalogService {
  getCategories() {
    return cached('categories', {}, CATEGORIES_TTL, () =>
      upstream.get<Envelope<unknown[]>>('/api/categories'),
    );
  }

  getLeaderboard() {
    return cached('leaderboard', {}, LIVE_TTL, () =>
      upstream.get<Envelope<unknown[]>>('/api/leaderboard'),
    );
  }

  /** `userId` adds `isFavorited` to each item; the cached upstream body itself is shared. */
  async listGames(query: GamesQuery, userId?: string) {
    const params =
      query.featured === 'true'
        ? { featured: true }
        : { page: query.page, limit: query.limit, category: query.category, sort: query.sort };
    const body = await cached('games', params, LIVE_TTL, () =>
      upstream.get<Envelope<GameSummary[]>>('/api/games', params),
    );
    return { ...body, data: await this.withFavourites(body.data, userId) };
  }

  async getGame(slug: string, userId?: string) {
    const body = await cached('game', { slug }, LIVE_TTL, () =>
      upstream.get<Envelope<GameDetails>>(`/api/games/${encodeURIComponent(slug)}`),
    );
    const liked = userId ? await favouritesRepository.has(userId, slug) : false;
    return { ...body, data: { ...body.data, isLikedByCurrentUser: liked } };
  }

  /** The whole library (all pages), used to show a user's favourites. */
  listAllGames() {
    return cached('games-all', {}, ALL_GAMES_TTL, async () => {
      const games: GameSummary[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const body = await upstream.get<Envelope<GameSummary[]>>('/api/games', {
          page,
          limit: 100,
          category: 'all',
          sort: 'rating-desc',
        });
        games.push(...body.data);
        if (page >= Number(body.meta?.totalPages ?? 1)) break;
      }
      return games;
    });
  }

  private async withFavourites(games: GameSummary[], userId?: string) {
    if (!userId) return games;
    const slugs = new Set(await favouritesRepository.slugsFor(userId));
    return games.map((game) => ({ ...game, isFavorited: slugs.has(game.slug) }));
  }
}

export const catalogService = new CatalogService();
