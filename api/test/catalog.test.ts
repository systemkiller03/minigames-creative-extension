import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeConnections, newClient } from './helpers';
import {
  clearUpstreamCache,
  expireUpstreamCache,
  fakeUpstream,
  signedInUser,
} from './catalog-helpers';

afterAll(closeConnections);

beforeEach(async () => {
  fakeUpstream.reset();
  await clearUpstreamCache();
});

describe('GET /api/catalog', () => {
  it('serves categories and the leaderboard publicly, from cache the second time', async () => {
    const client = newClient();
    const categories = await client.get('/api/catalog/categories');
    expect(categories.status).toBe(200);
    expect(categories.body.data).toHaveLength(2);
    expect((await client.get('/api/catalog/categories')).status).toBe(200);
    expect(fakeUpstream.callsTo('GET', '/api/categories')).toHaveLength(1);

    const board = await client.get('/api/catalog/leaderboard');
    expect(board.status).toBe(200);
    expect(board.body.data[0].playerName).toBe('Alex');
  });

  it('lists games with defaults and treats default parameters as the same cache entry', async () => {
    const client = newClient();
    const plain = await client.get('/api/catalog/games');
    expect(plain.status).toBe(200);
    expect(plain.body.data.map((game: { slug: string }) => game.slug)).toEqual([
      'alpha-quest',
      'beta-farm',
      'gamma-cards',
      'delta-arcade',
    ]);
    expect(plain.body.meta).toMatchObject({ page: 1, limit: 10, totalItems: 4 });

    await client.get('/api/catalog/games?page=1&limit=10&category=all&sort=rating-desc');
    expect(fakeUpstream.callsTo('GET', '/api/games')).toHaveLength(1);
  });

  it('filters, sorts and paginates', async () => {
    const client = newClient();
    const res = await client.get('/api/catalog/games?sort=name-desc&limit=2&page=2');
    expect(res.body.data.map((game: { slug: string }) => game.slug)).toEqual([
      'beta-farm',
      'alpha-quest',
    ]);
    const farm = await client.get('/api/catalog/games?category=farm');
    expect(farm.body.data).toHaveLength(1);
  });

  it('featured=true ignores the other parameters', async () => {
    const res = await newClient().get('/api/catalog/games?featured=true&page=9&category=card');
    expect(res.body.data).toHaveLength(2);
    expect(fakeUpstream.callsTo('GET', '/api/games')[0]?.query).toEqual({ featured: true });
  });

  it('rejects bad query parameters without calling the upstream', async () => {
    const client = newClient();
    for (const query of ['limit=0', 'limit=101', 'page=abc', 'sort=best', 'category=A%20B']) {
      const res = await client.get(`/api/catalog/games?${query}`);
      expect(res.status, query).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(fakeUpstream.calls).toHaveLength(0);
  });

  it('returns game details, 404 for an unknown game and 400 for a malformed slug', async () => {
    const client = newClient();
    const ok = await client.get('/api/catalog/games/alpha-quest');
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ slug: 'alpha-quest', isLikedByCurrentUser: false });

    const missing = await client.get('/api/catalog/games/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');

    expect((await client.get('/api/catalog/games/Bad_Slug!')).status).toBe(400);
  });

  it('serves a stale copy when the upstream is down, and 502 when there is none', async () => {
    const client = newClient();
    await client.get('/api/catalog/games');
    await expireUpstreamCache();
    fakeUpstream.fail();

    const stale = await client.get('/api/catalog/games');
    expect(stale.status).toBe(200);
    expect(stale.body.data).toHaveLength(4);

    const uncached = await client.get('/api/catalog/leaderboard');
    expect(uncached.status).toBe(502);
    expect(uncached.body.error.code).toBe('UPSTREAM_ERROR');
  });

  it('does not report a missing game as stale-served', async () => {
    const client = newClient();
    await client.get('/api/catalog/games/alpha-quest');
    await expireUpstreamCache();
    fakeUpstream.games = [];
    expect((await client.get('/api/catalog/games/alpha-quest')).status).toBe(404);
  });

  it('adds isFavorited only for signed-in users and never pollutes the shared cache', async () => {
    const user = await signedInUser();
    await user.client.put('/api/me/favourites/beta-farm').set(user.auth);

    const signedIn = await newClient().get('/api/catalog/games').set(user.auth);
    const flags = Object.fromEntries(
      signedIn.body.data.map((game: { slug: string; isFavorited: boolean }) => [
        game.slug,
        game.isFavorited,
      ]),
    );
    expect(flags).toEqual({
      'alpha-quest': false,
      'beta-farm': true,
      'gamma-cards': false,
      'delta-arcade': false,
    });

    const anonymous = await newClient().get('/api/catalog/games');
    expect(anonymous.body.data[0]).not.toHaveProperty('isFavorited');

    const details = await newClient().get('/api/catalog/games/beta-farm').set(user.auth);
    expect(details.body.data.isLikedByCurrentUser).toBe(true);
    const other = await newClient().get('/api/catalog/games/beta-farm');
    expect(other.body.data.isLikedByCurrentUser).toBe(false);
  });

  it('rejects an invalid bearer token but allows no token', async () => {
    const client = newClient();
    const bad = await client
      .get('/api/catalog/games')
      .set('Authorization', 'Bearer aaaa.bbbb.cccc');
    expect(bad.status).toBe(401);
    expect((await client.get('/api/catalog/games')).status).toBe(200);
  });
});
