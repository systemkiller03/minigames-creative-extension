import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { pool, redis } from './helpers';
import {
  ORIGIN,
  closeConnections,
  createVerifiedUser,
  login,
  newClient,
  refreshCookie,
  refreshCookieValue,
  refreshWith,
  sessionIdOf,
} from './helpers';
import request from 'supertest';
import { app } from './helpers';

afterAll(closeConnections);
afterEach(() => vi.useRealTimers());

let user: { email: string; password: string };
beforeAll(async () => {
  user = await createVerifiedUser();
});

describe('login', () => {
  it('returns an access JWT in the body and the refresh JWT only as an httpOnly cookie', async () => {
    const res = await newClient().post('/api/auth/login').send(user);

    expect(res.status).toBe(200);
    expect(res.body.accessToken.split('.')).toHaveLength(3);
    expect(res.body.expiresIn).toBe(300);
    expect(res.body).not.toHaveProperty('refreshToken');
    expect(res.body).not.toHaveProperty('csrfToken');

    const cookie = refreshCookie(res)!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(res.headers['set-cookie']).toHaveLength(1); // no csrf cookie any more
  });

  it('rejects a wrong password and an unknown email identically', async () => {
    const wrong = await newClient()
      .post('/api/auth/login')
      .send({ ...user, password: 'Nope-Nope-1' });
    const unknown = await newClient()
      .post('/api/auth/login')
      .send({ email: 'nobody-here@example.test', password: 'Nope-Nope-1' });

    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('rate limits login attempts per IP', async () => {
    const client = newClient();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt++) {
      statuses.push(
        (await client.post('/api/auth/login').send({ ...user, password: 'Nope-Nope-1' })).status,
      );
    }
    expect(statuses.at(-1)).toBe(429);
  });
});

describe('access tokens', () => {
  it('authorize requests without any server-side lookup of the token', async () => {
    const client = newClient();
    const { accessToken } = await login(client, user);

    const ok = await request(app)
      .get('/api/me/sessions')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(ok.status).toBe(200);
  });

  it('are rejected when missing, malformed, tampered with, or not an access token', async () => {
    const client = newClient();
    const { accessToken } = await login(client, user);
    const refresh = await client.post('/api/auth/refresh');
    const refreshJwt = refreshCookieValue(refresh)!;

    const attempt = (authorization?: string) => {
      const req = request(app).get('/api/me/sessions');
      return authorization ? req.set('Authorization', authorization) : req;
    };
    expect((await attempt()).status).toBe(401);
    expect((await attempt('Bearer not-a-jwt')).status).toBe(401);
    expect((await attempt(`Bearer ${accessToken.slice(0, -3)}abc`)).status).toBe(401);
    expect((await attempt(`Bearer ${refreshJwt}`)).status).toBe(401); // wrong secret and audience
  });

  it('are rejected after they expire', async () => {
    const { accessToken } = await login(newClient(), user);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 5000);
    const res = await request(app)
      .get('/api/me/sessions')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
  });
});

describe('refresh', () => {
  it('rotates the refresh token and returns a new access token', async () => {
    const client = newClient();
    const first = await client.post('/api/auth/login').send(user);
    const firstCookie = refreshCookieValue(first)!;

    const res = await client.post('/api/auth/refresh');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.accessToken.split('.')).toHaveLength(3);
    expect(sessionIdOf(res.body.accessToken)).toBe(sessionIdOf(first.body.accessToken)); // same family
    expect(refreshCookieValue(res)).toBeTruthy();
    expect(refreshCookieValue(res)).not.toBe(firstCookie);
  });

  it('keeps working across many sequential rotations', async () => {
    const client = newClient();
    await login(client, user);
    for (let rotation = 0; rotation < 4; rotation++) {
      expect((await client.post('/api/auth/refresh')).status).toBe(200);
    }
  });

  it('requires a trusted Origin', async () => {
    const client = newClient();
    await login(client, user);

    const noOrigin = await client.post('/api/auth/refresh').unset('Origin');
    const badOrigin = await client.post('/api/auth/refresh').set('Origin', 'https://evil.example');
    expect(noOrigin.status).toBe(403);
    expect(badOrigin.status).toBe(403);
    expect((await client.post('/api/auth/refresh').set('Origin', ORIGIN)).status).toBe(200);
  });

  it('rejects a missing, tampered, or wrong-type cookie', async () => {
    const client = newClient();
    const loginRes = await client.post('/api/auth/login').send(user);
    const cookie = refreshCookieValue(loginRes)!;

    expect((await newClient().post('/api/auth/refresh')).status).toBe(401);
    expect((await refreshWith(`${cookie.slice(0, -3)}abc`)).status).toBe(401);
    expect((await refreshWith(loginRes.body.accessToken)).status).toBe(401);
    expect((await refreshWith('garbage')).status).toBe(401);
  });

  it('accepts a just-rotated token inside the 20 second grace window (two tabs)', async () => {
    const client = newClient();
    const loginRes = await client.post('/api/auth/login').send(user);
    const original = refreshCookieValue(loginRes)!;

    const tabOne = await refreshWith(original);
    const tabTwo = await refreshWith(original);
    expect(tabOne.status).toBe(200);
    expect(tabTwo.status).toBe(200);

    // The family survives: the newest token is still valid.
    expect((await refreshWith(refreshCookieValue(tabTwo)!)).status).toBe(200);
  });

  it('revokes the whole family when a stale token is replayed after the grace window', async () => {
    const client = newClient();
    const loginRes = await client.post('/api/auth/login').send(user);
    const stolen = refreshCookieValue(loginRes)!;
    const rotated = await refreshWith(stolen);
    const latest = refreshCookieValue(rotated)!;

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 21_000);
    const replay = await refreshWith(stolen);
    vi.useRealTimers();

    expect(replay.status).toBe(401);
    expect(replay.body.error.message).toMatch(/reuse/i);
    // The legitimate holder of the newest token is logged out too.
    expect((await refreshWith(latest)).status).toBe(401);
  });

  it('does not let an expired family refresh (absolute 30 day limit)', async () => {
    const client = newClient();
    const loginRes = await client.post('/api/auth/login').send(user);
    const sid = sessionIdOf(loginRes.body.accessToken);

    await redis.hset(`auth:family:${sid}`, 'maxExpiresAt', String(Date.now() - 1000));
    expect((await client.post('/api/auth/refresh')).status).toBe(401);
    expect(await redis.exists(`auth:family:${sid}`)).toBe(0);
  });

  it('revokes the family and fails when the account no longer exists', async () => {
    const doomed = await createVerifiedUser();
    const client = newClient();
    const loginRes = await client.post('/api/auth/login').send(doomed);
    const sid = sessionIdOf(loginRes.body.accessToken);

    await pool.query('DELETE FROM users WHERE email = $1', [doomed.email]);
    expect((await client.post('/api/auth/refresh')).status).toBe(401);
    expect(await redis.exists(`auth:family:${sid}`)).toBe(0);
  });
});

describe('what Redis stores', () => {
  it('holds only the refresh whitelist: no access token and no token itself', async () => {
    const client = newClient();
    const loginRes = await client.post('/api/auth/login').send(user);
    const { accessToken } = loginRes.body;
    const refreshJwt = refreshCookieValue(loginRes)!;
    const sid = sessionIdOf(accessToken);

    const family = await redis.hgetall(`auth:family:${sid}`);
    const stored = JSON.stringify(family);
    expect(stored).not.toContain(accessToken);
    expect(stored).not.toContain(refreshJwt);
    expect(Object.keys(family).sort()).toEqual(
      [
        'createdAt',
        'currentJti',
        'ipAddress',
        'lastSeenAt',
        'maxExpiresAt',
        'previousJti',
        'rotatedAt',
        'userAgent',
        'userId',
      ].sort(),
    );
    expect(await redis.keys('auth:access:*')).toEqual([]);

    // Idle expiry is the key TTL: about 7 days.
    const ttlSeconds = await redis.ttl(`auth:family:${sid}`);
    expect(ttlSeconds).toBeGreaterThan(7 * 24 * 3600 - 60);
    expect(ttlSeconds).toBeLessThanOrEqual(7 * 24 * 3600);
  });
});

describe('logout', () => {
  it('ends the family, clears the cookie, and refresh stops working', async () => {
    const client = newClient();
    const { accessToken } = await login(client, user);

    const res = await client.post('/api/auth/logout').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(204);
    expect(refreshCookie(res)).toMatch(/refresh_token=;/);
    expect((await client.post('/api/auth/refresh')).status).toBe(401);
  });

  it('requires authentication', async () => {
    expect((await newClient().post('/api/auth/logout')).status).toBe(401);
  });
});
