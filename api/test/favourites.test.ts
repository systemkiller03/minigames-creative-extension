import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeConnections, newClient, pool } from './helpers';
import { clearUpstreamCache, fakeUpstream, signedInUser } from './catalog-helpers';

afterAll(closeConnections);

beforeEach(async () => {
  fakeUpstream.reset();
  await clearUpstreamCache();
});

const syntheticEmail = (userId: string) => `u-${userId}@minigames-gateway.invalid`;

describe('PUT/DELETE /api/me/favourites/:slug', () => {
  it('requires authentication', async () => {
    const client = newClient();
    expect((await client.put('/api/me/favourites/alpha-quest')).status).toBe(401);
    expect((await client.delete('/api/me/favourites/alpha-quest')).status).toBe(401);
    expect((await client.get('/api/me/favourites')).status).toBe(401);
  });

  it('adds a favourite and sends the upstream only a synthetic email', async () => {
    const user = await signedInUser();
    const res = await user.client.put('/api/me/favourites/alpha-quest').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      gameSlug: 'alpha-quest',
      isFavorited: true,
      likesCount: 101,
    });

    const posts = fakeUpstream.callsTo('POST', '/api/games/alpha-quest/favorite');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toEqual({ userEmail: syntheticEmail(user.userId) });
    expect(JSON.stringify(fakeUpstream.calls)).not.toContain(user.email);
  });

  it('is idempotent: repeating a request does not toggle the upstream back', async () => {
    const user = await signedInUser();
    for (let i = 0; i < 3; i += 1) {
      const res = await user.client.put('/api/me/favourites/alpha-quest').set(user.auth);
      expect(res.body.data.isFavorited).toBe(true);
    }
    expect(fakeUpstream.callsTo('POST', '/api/games/alpha-quest/favorite')).toHaveLength(1);
    expect(fakeUpstream.likeCount('alpha-quest')).toBe(101);

    for (let i = 0; i < 3; i += 1) {
      const res = await user.client.delete('/api/me/favourites/alpha-quest').set(user.auth);
      expect(res.status).toBe(200);
      expect(res.body.data.isFavorited).toBe(false);
    }
    expect(fakeUpstream.callsTo('POST', '/api/games/alpha-quest/favorite')).toHaveLength(2);
    expect(fakeUpstream.likeCount('alpha-quest')).toBe(100);
  });

  it('removing something never favourited does not call the upstream toggle', async () => {
    const user = await signedInUser();
    const res = await user.client.delete('/api/me/favourites/beta-farm').set(user.auth);
    expect(res.body.data.isFavorited).toBe(false);
    expect(fakeUpstream.callsTo('POST', '/api/games/beta-farm/favorite')).toHaveLength(0);
  });

  it('answers 404 for an unknown game and stores nothing', async () => {
    const user = await signedInUser();
    const res = await user.client.put('/api/me/favourites/no-such-game').set(user.auth);
    expect(res.status).toBe(404);
    const rows = await pool.query(`SELECT 1 FROM favourites WHERE user_id = $1`, [user.userId]);
    expect(rows.rowCount).toBe(0);
  });

  it('rejects a malformed slug', async () => {
    const user = await signedInUser();
    const res = await user.client.put('/api/me/favourites/Bad_Slug').set(user.auth);
    expect(res.status).toBe(400);
  });

  it('undoes the local change when the upstream toggle fails', async () => {
    const user = await signedInUser();
    await newClient().get('/api/catalog/games/alpha-quest'); // warm the details cache
    fakeUpstream.fail();

    const res = await user.client.put('/api/me/favourites/alpha-quest').set(user.auth);
    expect(res.status).toBe(502);
    const rows = await pool.query(`SELECT 1 FROM favourites WHERE user_id = $1`, [user.userId]);
    expect(rows.rowCount).toBe(0);
  });

  it('restores the row when removing fails upstream', async () => {
    const user = await signedInUser();
    await user.client.put('/api/me/favourites/alpha-quest').set(user.auth);
    fakeUpstream.fail();

    const res = await user.client.delete('/api/me/favourites/alpha-quest').set(user.auth);
    expect(res.status).toBe(502);
    fakeUpstream.failure = null;
    const list = await user.client.get('/api/me/favourites').set(user.auth);
    expect(list.body.data.map((game: { slug: string }) => game.slug)).toEqual(['alpha-quest']);
  });

  it('repairs drift when the upstream already holds the opposite state', async () => {
    const user = await signedInUser();
    fakeUpstream.likes.set('alpha-quest', new Set([syntheticEmail(user.userId)]));

    const res = await user.client.put('/api/me/favourites/alpha-quest').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.isFavorited).toBe(true);
    expect(fakeUpstream.emails('alpha-quest').has(syntheticEmail(user.userId))).toBe(true);
    expect(fakeUpstream.callsTo('POST', '/api/games/alpha-quest/favorite')).toHaveLength(2);
  });

  it('keeps users independent and refreshes the cached like count', async () => {
    const first = await signedInUser();
    const second = await signedInUser();
    await first.client.put('/api/me/favourites/alpha-quest').set(first.auth);

    const detailsBefore = await newClient().get('/api/catalog/games/alpha-quest');
    expect(detailsBefore.body.data.likesCount).toBe(101);
    await second.client.put('/api/me/favourites/alpha-quest').set(second.auth);
    const detailsAfter = await newClient().get('/api/catalog/games/alpha-quest');
    expect(detailsAfter.body.data.likesCount).toBe(102);

    await first.client.delete('/api/me/favourites/alpha-quest').set(first.auth);
    const mine = await second.client.get('/api/me/favourites').set(second.auth);
    expect(mine.body.meta.totalItems).toBe(1);
  });
});

describe('GET /api/me/favourites', () => {
  it('lists the favourites as game summaries, newest first', async () => {
    const user = await signedInUser();
    expect((await user.client.get('/api/me/favourites').set(user.auth)).body).toEqual({
      data: [],
      meta: { totalItems: 0 },
    });

    for (const slug of ['gamma-cards', 'alpha-quest', 'beta-farm']) {
      await user.client.put(`/api/me/favourites/${slug}`).set(user.auth);
    }
    const res = await user.client.get('/api/me/favourites').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.map((game: { slug: string }) => game.slug)).toEqual([
      'beta-farm',
      'alpha-quest',
      'gamma-cards',
    ]);
    expect(res.body.data[0]).toMatchObject({
      name: 'Beta Farm',
      cardImage: '/assets/beta-farm.jpg',
      isFavorited: true,
    });
    expect(res.body.meta.totalItems).toBe(3);
  });

  it('skips games that are no longer in the catalog', async () => {
    const user = await signedInUser();
    await user.client.put('/api/me/favourites/alpha-quest').set(user.auth);
    await pool.query(`INSERT INTO favourites (user_id, game_slug) VALUES ($1, 'removed-game')`, [
      user.userId,
    ]);
    const res = await user.client.get('/api/me/favourites').set(user.auth);
    expect(res.body.data.map((game: { slug: string }) => game.slug)).toEqual(['alpha-quest']);
    expect(res.body.meta.totalItems).toBe(1);
  });
});

describe('account deletion', () => {
  it('takes the likes off the upstream and removes the rows', async () => {
    const user = await signedInUser();
    await user.client.put('/api/me/favourites/alpha-quest').set(user.auth);
    await user.client.put('/api/me/favourites/beta-farm').set(user.auth);
    expect(fakeUpstream.likeCount('alpha-quest')).toBe(101);

    const res = await user.client
      .delete('/api/auth/account')
      .set(user.auth)
      .send({ password: user.password, confirm: true });
    expect(res.status).toBe(204);

    expect(fakeUpstream.likeCount('alpha-quest')).toBe(100);
    expect(fakeUpstream.likeCount('beta-farm')).toBe(100);
    const rows = await pool.query(`SELECT 1 FROM favourites WHERE user_id = $1`, [user.userId]);
    expect(rows.rowCount).toBe(0);
  });

  it('still deletes the account when the upstream is down', async () => {
    const user = await signedInUser();
    await user.client.put('/api/me/favourites/alpha-quest').set(user.auth);
    fakeUpstream.fail();

    const res = await user.client
      .delete('/api/auth/account')
      .set(user.auth)
      .send({ password: user.password, confirm: true });
    expect(res.status).toBe(204);
    const rows = await pool.query(`SELECT 1 FROM users WHERE id = $1`, [user.userId]);
    expect(rows.rowCount).toBe(0);
  });
});
