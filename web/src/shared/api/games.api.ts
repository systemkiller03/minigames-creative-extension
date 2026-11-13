import { z } from 'zod';
import { apiRequest } from './client';
import { getGameCardImage } from '@/shared/utils/game-images';

export const SORT_KEYS = ['rating-desc', 'rating-asc', 'name-asc', 'name-desc'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

const gameSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  category: z.string(),
  price: z.string(),
  shortDescription: z.string(),
  rating: z.coerce.number().finite().min(0).max(5),
  likesCount: z.coerce.number().int().nonnegative(),
  cardImage: z.string().min(1),
  isFavorited: z.boolean().optional(),
});

const paginationMetaSchema = z.object({
  page: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().positive(),
  totalItems: z.coerce.number().int().nonnegative(),
  totalPages: z.coerce.number().int().nonnegative(),
});

const gamesResponseSchema = z.object({
  data: z.array(gameSchema),
  meta: paginationMetaSchema.partial().optional(),
});

const categorySchema = z.object({
  slug: z.string().min(1),
  label: z.string().min(1),
  isDefault: z.boolean(),
});

const gameDetailsSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  heroImage: z.string().optional(),
  rating: z.coerce.number().finite().min(0).max(5),
  likesCount: z.coerce.number().int().nonnegative(),
  isLikedByCurrentUser: z.boolean().optional(),
  fullDescription: z.string().optional(),
  specs: z
    .object({
      genre: z.string().optional(),
      players: z.string().optional(),
      duration: z.string().optional(),
      price: z.string().optional(),
    })
    .optional(),
  topRecords: z
    .array(
      z.object({
        position: z.coerce.number().int().positive(),
        playerName: z.string(),
        score: z.coerce.number().int().nonnegative(),
        achievedAt: z.string().optional(),
      }),
    )
    .optional(),
});

const favouriteStateSchema = z.object({
  data: z.object({
    gameSlug: z.string(),
    isFavorited: z.boolean(),
    likesCount: z.coerce.number().int().nonnegative(),
  }),
});

export type Game = z.infer<typeof gameSchema>;
export type Category = z.infer<typeof categorySchema>;
export type GameDetails = z.infer<typeof gameDetailsSchema>;
export type FavouriteState = z.infer<typeof favouriteStateSchema>['data'];
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type GamesPage = { games: Game[]; meta: PaginationMeta };

export type GetGamesOptions = {
  page?: number;
  limit?: number;
  category?: string;
  sort?: SortKey;
  signal?: AbortSignal | undefined;
};

function withLocalImage(game: z.infer<typeof gameSchema>): Game {
  const cardImage = getGameCardImage(game.slug);
  if (!cardImage) {
    throw new Error(`Local card image not found for ${game.slug}`);
  }
  return { ...game, cardImage };
}

export async function getGamesPage({
  page = 1,
  limit = 10,
  category,
  sort = 'rating-desc',
  signal,
}: GetGamesOptions = {}): Promise<GamesPage> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit), sort });
  if (category && category !== 'all') {
    query.set('category', category);
  }

  const response = await apiRequest<unknown>(`/catalog/games?${query.toString()}`, { signal });
  const parsed = gamesResponseSchema.parse(response);
  const games = parsed.data.map(withLocalImage);

  return {
    games,
    meta: {
      page: parsed.meta?.page ?? page,
      limit: parsed.meta?.limit ?? limit,
      totalItems: parsed.meta?.totalItems ?? games.length,
      totalPages: parsed.meta?.totalPages ?? 1,
    },
  };
}

export async function getFeaturedGames(signal?: AbortSignal): Promise<Game[]> {
  const response = await apiRequest<unknown>('/catalog/games?featured=true', { signal });
  return gamesResponseSchema.parse(response).data.map(withLocalImage);
}

export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  const response = await apiRequest<unknown>('/catalog/categories', { signal });
  return z.object({ data: z.array(categorySchema) }).parse(response).data;
}

export async function getGameDetails(slug: string, signal?: AbortSignal): Promise<GameDetails> {
  const response = await apiRequest<unknown>(`/catalog/games/${encodeURIComponent(slug)}`, {
    signal,
  });
  return z.object({ data: gameDetailsSchema }).parse(response).data;
}

export async function setFavourite(slug: string, favourite: boolean): Promise<FavouriteState> {
  const response = await apiRequest<unknown>(`/me/favourites/${encodeURIComponent(slug)}`, {
    method: favourite ? 'PUT' : 'DELETE',
  });
  return favouriteStateSchema.parse(response).data;
}

export async function getFavouriteGames(signal?: AbortSignal): Promise<Game[]> {
  const response = await apiRequest<unknown>('/me/favourites', { signal });
  return gamesResponseSchema.parse(response).data.map(withLocalImage);
}
