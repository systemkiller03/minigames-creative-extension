import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { authIdentitiesRepository } from '@/repositories/auth-identities.repository';
import {
  CHROME_WINDOWS,
  FIREFOX_LINUX,
  app,
  closeConnections,
  createVerifiedUser,
  login,
  newClient,
  pool,
  register,
  uniqueEmail,
  waitForMail,
  sessionIdOf,
} from './helpers';

afterAll(closeConnections);

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const listSessions = (token: string) => request(app).get('/api/auth/sessions').set(bearer(token));

describe('devices (session families)', () => {
  it('lists one family per login with a device label and the current one flagged', async () => {
    const user = await createVerifiedUser();
    const laptop = newClient(CHROME_WINDOWS);
    const desktop = newClient(FIREFOX_LINUX);
    const a = await login(laptop, user);
    const b = await login(desktop, user);

    const res = await listSessions(a.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(2);

    const byDevice = Object.fromEntries(
      res.body.sessions.map((s: { device: string }) => [s.device, s]),
    );
    expect(byDevice['Chrome on Windows'].isCurrent).toBe(true);
    expect(byDevice['Firefox on Linux'].isCurrent).toBe(false);
    expect(byDevice['Chrome on Windows'].id).toBe(sessionIdOf(a.accessToken));
    expect(byDevice['Firefox on Linux'].id).toBe(sessionIdOf(b.accessToken));
    expect(new Date(byDevice['Chrome on Windows'].expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('keeps the same family id across refreshes', async () => {
    const user = await createVerifiedUser();
    const client = newClient();
    const first = await login(client, user);
    await client.post('/api/auth/refresh');
    const res = await listSessions(first.accessToken);
    expect(res.body.sessions).toHaveLength(1);
  });

  it('revokes another device, whose refresh then fails', async () => {
    const user = await createVerifiedUser();
    const laptop = newClient();
    const phone = newClient(FIREFOX_LINUX);
    const a = await login(laptop, user);
    const b = await login(phone, user);

    const res = await request(app)
      .delete(`/api/auth/sessions/${sessionIdOf(b.accessToken)}`)
      .set(bearer(a.accessToken));
    expect(res.status).toBe(204);

    expect((await phone.post('/api/auth/refresh')).status).toBe(401);
    expect((await laptop.post('/api/auth/refresh')).status).toBe(200);
    expect((await listSessions(a.accessToken)).body.sessions).toHaveLength(1);
  });

  it("cannot revoke another user's session", async () => {
    const alice = await createVerifiedUser();
    const mallory = await createVerifiedUser();
    const aliceClient = newClient();
    const a = await login(aliceClient, alice);
    const m = await login(newClient(), mallory);

    await request(app)
      .delete(`/api/auth/sessions/${sessionIdOf(a.accessToken)}`)
      .set(bearer(m.accessToken));

    expect((await aliceClient.post('/api/auth/refresh')).status).toBe(200);
  });

  it('logout-all ends every device', async () => {
    const user = await createVerifiedUser();
    const one = newClient();
    const two = newClient(FIREFOX_LINUX);
    const a = await login(one, user);
    await login(two, user);

    const res = await request(app).post('/api/auth/logout-all').set(bearer(a.accessToken));
    expect(res.status).toBe(204);
    expect((await one.post('/api/auth/refresh')).status).toBe(401);
    expect((await two.post('/api/auth/refresh')).status).toBe(401);
  });

  it('documented trade-off (D1): a revoked session access token works until it expires', async () => {
    const user = await createVerifiedUser();
    const client = newClient();
    const { accessToken } = await login(client, user);
    await client.post('/api/auth/logout').set(bearer(accessToken));

    expect((await listSessions(accessToken)).status).toBe(200);
    expect((await client.post('/api/auth/refresh')).status).toBe(401);
  });
});

describe('password reset', () => {
  it('replaces the password and revokes every session', async () => {
    const user = await createVerifiedUser();
    const device = newClient();
    await login(device, user);
    const newPassword = 'Brand-New-Pass-7';

    const client = newClient();
    await client.post('/api/auth/password-reset/request').send({ email: user.email });
    const code = await waitForMail('reset', user.email);
    const verified = await client
      .post('/api/auth/password-reset/verify')
      .send({ email: user.email, code });
    expect(verified.status).toBe(200);

    const done = await client
      .post('/api/auth/password-reset/confirm')
      .send({ email: user.email, resetToken: verified.body.resetToken, newPassword });
    expect(done.status).toBe(200);

    expect((await device.post('/api/auth/refresh')).status).toBe(401);
    expect((await newClient().post('/api/auth/login').send(user)).status).toBe(401);
    expect(
      (await newClient().post('/api/auth/login').send({ email: user.email, password: newPassword }))
        .status,
    ).toBe(200);
  });

  it('answers the same for unknown emails and sends nothing', async () => {
    const known = await createVerifiedUser();
    const a = await newClient()
      .post('/api/auth/password-reset/request')
      .send({ email: known.email });
    const b = await newClient()
      .post('/api/auth/password-reset/request')
      .send({ email: uniqueEmail() });
    expect(a.status).toBe(b.status);
    expect(a.body).toEqual(b.body);
  });

  it('rejects a wrong code and a reused reset token', async () => {
    const user = await createVerifiedUser();
    const client = newClient();
    await client.post('/api/auth/password-reset/request').send({ email: user.email });
    const code = await waitForMail('reset', user.email);

    const wrong = await client
      .post('/api/auth/password-reset/verify')
      .send({ email: user.email, code: code === '00000000' ? '11111111' : '00000000' });
    expect(wrong.status).toBe(401);

    const ok = await client
      .post('/api/auth/password-reset/verify')
      .send({ email: user.email, code });
    const body = {
      email: user.email,
      resetToken: ok.body.resetToken,
      newPassword: 'Another-Pass-42',
    };
    expect((await client.post('/api/auth/password-reset/confirm').send(body)).status).toBe(200);
    expect((await client.post('/api/auth/password-reset/confirm').send(body)).status).toBe(401);
  });

  it('also verifies an unverified email (E6)', async () => {
    const { email } = await register();
    const client = newClient();
    await client.post('/api/auth/password-reset/request').send({ email });
    const code = await waitForMail('reset', email);
    const verified = await client.post('/api/auth/password-reset/verify').send({ email, code });
    await client
      .post('/api/auth/password-reset/confirm')
      .send({ email, resetToken: verified.body.resetToken, newPassword: 'Fresh-Pass-55' });

    const res = await newClient()
      .post('/api/auth/login')
      .send({ email, password: 'Fresh-Pass-55' });
    expect(res.status).toBe(200);
  });
});

describe('google sign-in linking (E3)', () => {
  it('verifies a linked unverified password account and wipes its password', async () => {
    const { email, password } = await register();

    const user = await authIdentitiesRepository.findOrCreateGoogleUser({
      subject: `google-${randomUUID()}`,
      email,
      name: 'Real Owner',
    });
    expect(user.emailVerifiedAt).not.toBeNull();

    const row = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email]);
    expect(row.rows[0].password_hash).toBeNull();
    expect((await newClient().post('/api/auth/login').send({ email, password })).status).toBe(401);
  });

  it('keeps the password of an already verified account', async () => {
    const { email, password } = await createVerifiedUser();
    await authIdentitiesRepository.findOrCreateGoogleUser({
      subject: `google-${randomUUID()}`,
      email,
      name: 'Owner',
    });
    expect((await newClient().post('/api/auth/login').send({ email, password })).status).toBe(200);
  });

  it('creates a verified account for a new Google user', async () => {
    const email = uniqueEmail();
    const user = await authIdentitiesRepository.findOrCreateGoogleUser({
      subject: `google-${randomUUID()}`,
      email,
      name: 'New Person',
    });
    expect(user.emailVerifiedAt).not.toBeNull();
  });
});
