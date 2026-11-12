import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeConnections, newClient } from './helpers';
import { clearUpstreamCache, fakeUpstream, signedInUser } from './catalog-helpers';

afterAll(closeConnections);

beforeEach(async () => {
  fakeUpstream.reset();
  await clearUpstreamCache();
});

const post = (user: Awaited<ReturnType<typeof signedInUser>>, text: string, slug = 'alpha-quest') =>
  user.client.post(`/api/catalog/games/${slug}/comments`).set(user.auth).send({ text });

describe('comments', () => {
  it('requires authentication to post or like, not to read', async () => {
    const client = newClient();
    expect((await client.get('/api/catalog/games/alpha-quest/comments')).status).toBe(200);
    expect(
      (await client.post('/api/catalog/games/alpha-quest/comments').send({ text: 'x' })).status,
    ).toBe(401);
    expect(
      (await client.post('/api/catalog/comments/00000000-0000-4000-8000-000000000001/like')).status,
    ).toBe(401);
  });

  it('posts with the account name and a synthetic email, ignoring client-supplied identity', async () => {
    const user = await signedInUser();
    const res = await user.client
      .post('/api/catalog/games/alpha-quest/comments')
      .set(user.auth)
      .send({ text: '  Lovely game  ', authorName: 'Evil', userEmail: 'victim@x.test' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ authorName: 'Test User', text: 'Lovely game' });

    const sent = fakeUpstream.callsTo('POST', '/api/games/alpha-quest/comments')[0]?.body as Record<
      string,
      string
    >;
    expect(sent.userEmail).toBe(`u-${user.userId}@minigames-gateway.invalid`);
    expect(JSON.stringify(fakeUpstream.calls)).not.toContain(user.email);
  });

  it('validates comment text and slug', async () => {
    const user = await signedInUser();
    expect((await post(user, '   ')).status).toBe(400);
    expect((await post(user, 'x'.repeat(501))).status).toBe(400);
    expect((await post(user, 'hi', 'no-such-game')).status).toBe(404);
    expect(fakeUpstream.comments).toHaveLength(0);
  });

  it('lists newest first with limit and the full total', async () => {
    const user = await signedInUser();
    for (const text of ['one', 'two', 'three']) await post(user, text);
    const res = await newClient().get('/api/catalog/games/alpha-quest/comments?limit=2');
    expect(res.body.data.map((c: { text: string }) => c.text)).toEqual(['three', 'two']);
    expect(res.body.meta.totalComments).toBe(3);
    expect((await newClient().get('/api/catalog/games/alpha-quest/comments?limit=0')).status).toBe(
      400,
    );
    expect((await newClient().get('/api/catalog/games/alpha-quest/comments?sort=top')).status).toBe(
      400,
    );
  });

  it('toggles a like and reports it per user without caching it for others', async () => {
    const author = await signedInUser();
    const fan = await signedInUser();
    const created = await post(author, 'hello');
    const id = created.body.data.commentId as string;

    const liked = await fan.client.post(`/api/catalog/comments/${id}/like`).set(fan.auth);
    expect(liked.body.data).toEqual({ isLikedByCurrentUser: true, likesCount: 1 });

    const mine = await newClient().get('/api/catalog/games/alpha-quest/comments').set(fan.auth);
    expect(mine.body.data[0].isLikedByCurrentUser).toBe(true);
    const anon = await newClient().get('/api/catalog/games/alpha-quest/comments');
    expect(anon.body.data[0].isLikedByCurrentUser).toBe(false);
    const other = await newClient().get('/api/catalog/games/alpha-quest/comments').set(author.auth);
    expect(other.body.data[0].isLikedByCurrentUser).toBe(false);

    const unliked = await fan.client.post(`/api/catalog/comments/${id}/like`).set(fan.auth);
    expect(unliked.body.data).toEqual({ isLikedByCurrentUser: false, likesCount: 0 });
  });

  it('404s an unknown comment and 400s a malformed id', async () => {
    const user = await signedInUser();
    const missing = await user.client
      .post('/api/catalog/comments/00000000-0000-4000-8000-0000000000ff/like')
      .set(user.auth);
    expect(missing.status).toBe(404);
    expect(
      (await user.client.post('/api/catalog/comments/not-an-id/like').set(user.auth)).status,
    ).toBe(400);
  });

  it('serves stale anonymous comments when the upstream is down', async () => {
    const client = newClient();
    await client.get('/api/catalog/games/alpha-quest/comments');
    const { expireUpstreamCache } = await import('./catalog-helpers');
    await expireUpstreamCache();
    fakeUpstream.fail();
    expect((await client.get('/api/catalog/games/alpha-quest/comments')).status).toBe(200);
  });
});
