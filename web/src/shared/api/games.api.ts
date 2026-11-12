import { z } from 'zod';
import { getApiData } from './client';
import { getGameCardImage } from '@/shared/utils/game-images';

const gameSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  category: z.string(),
  price: z.string(),
  shortDescription: z.string(),
  rating: z.coerce.number().finite().min(0).max(5),
  likesCount: z.coerce.number().int().nonnegative(),
  cardImage: z.string().min(1),
});

const gamesResponseSchema = z.object({
  data: z.array(gameSchema),
});

export type Game = z.infer<typeof gameSchema>;

type GetGamesOptions = {
  featured?: boolean;
  signal?: AbortSignal;
};

export async function getGames({ featured = false, signal }: GetGamesOptions = {}): Promise<
  Game[]
> {
  const response = await getApiData<unknown>(featured ? '/games?featured=true' : '/games', signal);
  const games = gamesResponseSchema.parse(response).data;

  return games.map((game) => {
    const cardImage = getGameCardImage(game.slug);
    if (!cardImage) {
      throw new Error(`Local card image not found for ${game.slug}`);
    }

    return { ...game, cardImage };
  });
}
