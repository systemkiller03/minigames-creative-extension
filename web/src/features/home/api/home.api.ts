import { z } from 'zod';
import { getApiData } from '@/shared/api/client';
import { getFeaturedGames as fetchFeaturedGames, type Game } from '@/shared/api/games.api';

const leaderboardPlayerSchema = z.object({
  rank: z.coerce.number().int().positive(),
  playerName: z.string().min(1),
  gamesPlayed: z.coerce.number().int().nonnegative(),
  totalScore: z.coerce.number().int().nonnegative(),
  streakDays: z.coerce.number().int().nonnegative(),
  favoriteGameName: z.string(),
});

const leaderboardResponseSchema = z.object({
  data: z.array(leaderboardPlayerSchema),
});

export type FeaturedGame = Game;

export type LeaderboardPlayer = z.infer<typeof leaderboardPlayerSchema>;

export function getFeaturedGames(signal?: AbortSignal): Promise<FeaturedGame[]> {
  return fetchFeaturedGames(signal);
}

export async function getLeaderboardPlayers(signal?: AbortSignal): Promise<LeaderboardPlayer[]> {
  const response = await getApiData<unknown>('/catalog/leaderboard', signal);
  return leaderboardResponseSchema.parse(response).data;
}
