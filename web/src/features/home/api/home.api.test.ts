import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '@/test/utils';
import { getFeaturedGames, getLeaderboardPlayers } from './home.api';

const fetchMock = vi.fn();
beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('home api', () => {
  it('parses the leaderboard', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            rank: 1,
            playerName: 'Alex',
            gamesPlayed: '10',
            totalScore: 100,
            streakDays: 2,
            favoriteGameName: '',
          },
        ],
      }),
    );
    const players = await getLeaderboardPlayers();
    expect(players[0]?.gamesPlayed).toBe(10);
  });

  it('loads featured games', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
    expect(await getFeaturedGames()).toEqual([]);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('featured=true');
  });
});
