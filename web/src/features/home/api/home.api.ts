import { z } from 'zod';
import { getApiData } from '@/shared/api/client';
import { getGameCardImage } from '@/shared/utils/game-images';

const featuredGameSchema = z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    category: z.string(),
    price: z.string(),
    shortDescription: z.string(),
    rating: z.coerce.number().finite().min(0).max(5),
    likesCount: z.coerce.number().int().nonnegative(),
    cardImage: z.string().min(1),
});

const featuredGamesResponseSchema = z.object({
    data: z.array(featuredGameSchema),
});

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

export type FeaturedGame = z.infer<typeof featuredGameSchema> & {
    cardImage: string;
};

export type LeaderboardPlayer = z.infer<typeof leaderboardPlayerSchema>;

export async function getFeaturedGames(signal?: AbortSignal): Promise<FeaturedGame[]> {
    const response = await getApiData<unknown>('/games?featured=true', signal);
    const games = featuredGamesResponseSchema.parse(response).data;

    return games.map((game) => {
        const cardImage = getGameCardImage(game.slug);
        if (!cardImage) {
            throw new Error(`Local card image not found for ${game.slug}`);
        }

        return { ...game, cardImage };
    });
}

export async function getLeaderboardPlayers(signal?: AbortSignal): Promise<LeaderboardPlayer[]> {
    const response = await getApiData<unknown>('/leaderboard', signal);
    return leaderboardResponseSchema.parse(response).data;
}
