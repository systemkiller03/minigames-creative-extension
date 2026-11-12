import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { authIdentitiesRepository } from '@/repositories/auth-identities.repository';
import { tokenService } from '@/services/token.service';
import {
  FIREFOX_LINUX,
  app,
  closeConnections,
  createVerifiedUser,
  login,
  newClient,
  pool,
  redis,
  refreshCookie,
  register,
  uniqueEmail,
  waitForMail,
} from './helpers';
import { hashToken } from '@/middlewares/auth.middleware';

afterAll(closeConnections);

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const countUsers = async (email: string) =>
  Number((await pool.query('SELECT count(*) FROM users WHERE email = $1', [email])).rows[0].count);

describe('DELETE /auth/account', () => {
  it('requires authentication', async () => {
    const res = await request(app).delete('/api/auth/account').send({ confirm: true });
    expect(res.status).toBe(401);
  });

  it('deletes the user, ends every session and clears the cookie', async () => {
    const user = await createVerifiedUser();
    const here = newClient();
    const other = newClient(FIREFOX_LINUX);
    const { accessToken, user: profile } = await login(here, user);
    await login(other, user);

    const res = await request(app)
      .delete('/api/auth/account')
      .set(bearer(accessToken))
      .send({ password: user.password, confirm: true });
    expect(res.status).toBe(204);
    expect(refreshCookie(res)).toMatch(/refresh_token=;.*Path=\/api\/auth/);

    expect(await countUsers(user.email)).toBe(0);
    expect(await redis.exists(`auth:user-families:${profile.id}`)).toBe(0);
    expect((await here.post('/api/auth/refresh')).status).toBe(401);
    expect((await other.post('/api/auth/refresh')).status).toBe(401);
    expect((await newClient().post('/api/auth/login').send(user)).status).toBe(401);
  });

  it('keeps the account when the password is wrong or confirm is missing', async () => {
    const user = await createVerifiedUser();
    const client = newClient();
    const { accessToken } = await login(client, user);
    const send = (body: object) =>
      request(app).delete('/api/auth/account').set(bearer(accessToken)).send(body);

    expect((await send({ password: 'Wrong-Wrong-1', confirm: true })).status).toBe(403);
    expect((await send({ confirm: true })).status).toBe(403);
    expect((await send({ password: user.password })).status).toBe(400);
    expect((await send({ password: user.password, confirm: false })).status).toBe(400);

    expect(await countUsers(user.email)).toBe(1);
    expect((await client.post('/api/auth/refresh')).status).toBe(200);
  });

  it('limits password guesses per user', async () => {
    const user = await createVerifiedUser();
    const { accessToken } = await login(newClient(), user);
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await request(app)
        .delete('/api/auth/account')
        .set(bearer(accessToken))
        .send({ password: 'Wrong-Wrong-1', confirm: true });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([403, 403, 403, 403, 403]);
    expect(statuses[5]).toBe(429);
  });

  it('removes linked Google identities along with the user', async () => {
    const user = await createVerifiedUser();
    const subject = `google-${randomUUID()}`;
    const linked = await authIdentitiesRepository.findOrCreateGoogleUser({
      subject,
      email: user.email,
      name: 'Owner',
    });
    const { accessToken } = await login(newClient(), user);

    await request(app)
      .delete('/api/auth/account')
      .set(bearer(accessToken))
      .send({ password: user.password, confirm: true });

    const identities = await pool.query('SELECT 1 FROM auth_identities WHERE user_id = $1', [
      linked.id,
    ]);
    expect(identities.rowCount).toBe(0);
  });

  it('lets a Google-only account delete itself with confirm alone', async () => {
    const email = uniqueEmail();
    const google = await authIdentitiesRepository.findOrCreateGoogleUser({
      subject: `google-${randomUUID()}`,
      email,
      name: 'Google Person',
    });
    const token = tokenService.signAccessToken({ userId: google.id, sessionId: randomUUID() });

    const res = await request(app)
      .delete('/api/auth/account')
      .set(bearer(token))
      .send({ confirm: true });
    expect(res.status).toBe(204);
    expect(await countUsers(email)).toBe(0);
  });

  it('drops pending verification and reset codes, so they cannot be replayed', async () => {
    const { email } = await register();
    await waitForMail('verify', email);
    const resetClient = newClient();
    await resetClient.post('/api/auth/password-reset/request').send({ email });
    await waitForMail('reset', email);
    const keys = [
      `auth:email-verify:${hashToken(email)}`,
      `auth:password-reset:request:${hashToken(email)}`,
    ];
    expect(await redis.exists(...keys)).toBe(2);

    // The account is unverified, so it cannot log in; use a token for it directly.
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const token = tokenService.signAccessToken({ userId: rows[0].id, sessionId: randomUUID() });
    const res = await request(app)
      .delete('/api/auth/account')
      .set(bearer(token))
      .send({ password: 'Correct-Horse-9', confirm: true });
    expect(res.status).toBe(204);
    expect(await redis.exists(...keys)).toBe(0);
  });

  it('answers 401 when the account is already gone (token still valid for minutes)', async () => {
    const user = await createVerifiedUser();
    const { accessToken } = await login(newClient(), user);
    const body = { password: user.password, confirm: true };

    await request(app).delete('/api/auth/account').set(bearer(accessToken)).send(body);
    const again = await request(app)
      .delete('/api/auth/account')
      .set(bearer(accessToken))
      .send(body);
    expect(again.status).toBe(401);
  });
});
