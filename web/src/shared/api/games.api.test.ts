import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '@/test/utils';
import {
  getCategories,
  getFavouriteGames,
  getFeaturedGames,
  getGameDetails,
  getGamesPage,
  setFavourite,
} from './games.api';

const fetchMock = vi.fn();
const game = {
  slug: 'cast-n-chill',
  name: 'Cast n Chill',
  category: 'casual',
  price: 'Free',
  shortDescription: 'Fish',
  rating: '4.5',
  likesCount: 10,
  cardImage: 'remote.jpg',
};

beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('games api', () => {
  it('builds the catalog query and swaps in the local image', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [game], meta: { page: 2, limit: 6, totalItems: 12, totalPages: 2 } }),
    );
    const result = await getGamesPage({ page: 2, limit: 6, category: 'casual', sort: 'name-asc' });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('limit=6');
    expect(url).toContain('category=casual');
    expect(url).toContain('sort=name-asc');
    expect(result.meta.totalPages).toBe(2);
    expect(result.games[0]?.rating).toBe(4.5);
    expect(result.games[0]?.cardImage).toContain('cast-n-chill-card');
  });

  it('omits the category for "all" and defaults the meta', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [game] }));
    const result = await getGamesPage({ category: 'all' });
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('category=');
    expect(result.meta).toEqual({ page: 1, limit: 10, totalItems: 1, totalPages: 1 });
  });

  it('fails when a local card image is missing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ ...game, slug: 'missing' }] }));
    await expect(getGamesPage()).rejects.toThrow('Local card image not found');
  });

  it('loads featured games, categories, details and favourites', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [game] }));
    expect(await getFeaturedGames()).toHaveLength(1);

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [{ slug: 'all', label: 'All', isDefault: true }] }),
    );
    expect(await getCategories()).toEqual([{ slug: 'all', label: 'All', isDefault: true }]);

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { slug: 'a b', name: 'A', rating: 3, likesCount: 1 } }),
    );
    expect((await getGameDetails('a b')).name).toBe('A');
    expect(fetchMock.mock.calls[2]?.[0]).toContain('/catalog/games/a%20b');

    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [game] }));
    expect(await getFavouriteGames()).toHaveLength(1);
  });

  it('uses PUT/DELETE for favourites', async () => {
    const state = { data: { gameSlug: 'x', isFavorited: true, likesCount: 3 } };
    fetchMock.mockResolvedValueOnce(jsonResponse(state));
    await setFavourite('x', true);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('PUT');
    fetchMock.mockResolvedValueOnce(jsonResponse(state));
    await setFavourite('x', false);
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe('DELETE');
  });
});
