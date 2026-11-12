import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { authIdentitiesRepository } from '@/repositories/auth-identities.repository';
import { tokenService } from '@/services/token.service';
import {
  FIREFOX_LINUX,
  PASSWORD,
  app,
  closeConnections,
  createVerifiedUser,
  login,
  newClient,
  refreshCookie,
  sessionIdOf,
  uniqueEmail,
} from './helpers';

afterAll(closeConnections);

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('GET /me', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/me')).status).toBe(401);
  });

  it('returns the profile without secrets', async () => {
    const user = await createVerifiedUser();
    const { accessToken } = await login(newClient(), user);

    const res = await request(app).get('/api/me').set(bearer(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      email: user.email,
      name: 'Test User',
      emailVerified: true,
      hasPassword: true,
      providers: [],
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password_?hash|\$argon2/i);
  });

  it('lists linked providers and reports a Google-only account as passwordless', async () => {
    const email = uniqueEmail();
    const google = await authIdentitiesRepository.findOrCreateGoogleUser({
      subject: `google-${randomUUID()}`,
      email,
      name: 'Google Person',
    });
    const token = tokenService.signAccessToken({ userId: google.id, sessionId: randomUUID() });

    const res = await request(app).get('/api/me').set(bearer(token));
    expect(res.body.user.providers).toEqual(['google']);
    expect(res.body.user.hasPassword).toBe(false);
  });
});

describe('PATCH /me', () => {
  it('updates the display name', async () => {
    const user = await createVerifiedUser();
    const { accessToken } = await login(newClient(), user);

    const res = await request(app)
      .patch('/api/me')
      .set(bearer(accessToken))
      .send({ name: '  New Name ' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('New Name');
    expect((await request(app).get('/api/me').set(bearer(accessToken))).body.user.name).toBe(
      'New Name',
    );
  });

  it('ignores attempts to change the email or other fields', async () => {
    const user = await createVerifiedUser();
    const { accessToken } = await login(newClient(), user);

    const res = await request(app)
      .patch('/api/me')
      .set(bearer(accessToken))
      .send({ name: 'Valid Name', email: 'evil@example.test', emailVerified: false });
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.emailVerified).toBe(true);
  });

  it('validates the name', async () => {
    const user = await createVerifiedUser();
    const { accessToken } = await login(newClient(), user);
    const res = await request(app).patch('/api/me').set(bearer(accessToken)).send({ name: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('POST /me/password', () => {
  const newPassword = 'Changed-Pass-88';

  it('changes the password, ends every session and clears the refresh cookie', async () => {
    const user = await createVerifiedUser();
    const current = newClient();
    const other = newClient(FIREFOX_LINUX);
    const { accessToken } = await login(current, user);
    await login(other, user);

    const res = await request(app)
      .post('/api/me/password')
      .set(bearer(accessToken))
      .send({ currentPassword: user.password, newPassword });
    expect(res.status).toBe(204);
    expect(refreshCookie(res)).toMatch(/refresh_token=;.*Path=\/api\/auth/);

    expect((await current.post('/api/auth/refresh')).status).toBe(401);
    expect((await other.post('/api/auth/refresh')).status).toBe(401);
    expect((await newClient().post('/api/auth/login').send(user)).status).toBe(401);
    expect(
      (await newClient().post('/api/auth/login').send({ email: user.email, password: newPassword }))
        .status,
    ).toBe(200);
  });

  it('rejects a wrong current password with 403 and changes nothing', async () => {
    const user = await createVerifiedUser();
    const client = newClient();
    const { accessToken } = await login(client, user);

    const res = await request(app)
      .post('/api/me/password')
      .set(bearer(accessToken))
      .send({ currentPassword: 'Wrong-Wrong-1', newPassword });
    expect(res.status).toBe(403);
    expect((await client.post('/api/auth/refresh')).status).toBe(200);
    expect((await newClient().post('/api/auth/login').send(user)).status).toBe(200);
  });

  it('rejects an unchanged password and weak input', async () => {
    const user = await createVerifiedUser();
    const { accessToken } = await login(newClient(), user);
    const send = (body: object) =>
      request(app).post('/api/me/password').set(bearer(accessToken)).send(body);

    expect((await send({ currentPassword: PASSWORD, newPassword: PASSWORD })).status).toBe(400);
    expect((await send({ currentPassword: PASSWORD, newPassword: 'short' })).status).toBe(400);
  });

  it('answers 409 for an account without a password', async () => {
    const google = await authIdentitiesRepository.findOrCreateGoogleUser({
      subject: `google-${randomUUID()}`,
      email: uniqueEmail(),
      name: 'Google Person',
    });
    const token = tokenService.signAccessToken({ userId: google.id, sessionId: randomUUID() });

    const res = await request(app)
      .post('/api/me/password')
      .set(bearer(token))
      .send({ currentPassword: 'whatever-1', newPassword });
    expect(res.status).toBe(409);
  });

  it('limits guesses of the current password per user', async () => {
    const user = await createVerifiedUser();
    const { accessToken } = await login(newClient(), user);
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await request(app)
        .post('/api/me/password')
        .set(bearer(accessToken))
        .send({ currentPassword: 'Wrong-Wrong-1', newPassword });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([403, 403, 403, 403, 403]);
    expect(statuses[5]).toBe(429);
  });
});

describe('DELETE /me/sessions (log out everywhere else)', () => {
  it('keeps the current device and ends the others', async () => {
    const user = await createVerifiedUser();
    const here = newClient();
    const phone = newClient(FIREFOX_LINUX);
    const tablet = newClient(FIREFOX_LINUX);
    const { accessToken } = await login(here, user);
    await login(phone, user);
    await login(tablet, user);

    const res = await request(app).delete('/api/me/sessions').set(bearer(accessToken));
    expect(res.status).toBe(204);

    expect((await here.post('/api/auth/refresh')).status).toBe(200);
    expect((await phone.post('/api/auth/refresh')).status).toBe(401);
    expect((await tablet.post('/api/auth/refresh')).status).toBe(401);
    const list = await request(app).get('/api/me/sessions').set(bearer(accessToken));
    expect(list.body.sessions).toHaveLength(1);
    expect(list.body.sessions[0].id).toBe(sessionIdOf(accessToken));
  });
});

describe('DELETE /me/sessions/:sessionId', () => {
  it('clears the cookie (on the auth path) when revoking the current session', async () => {
    const user = await createVerifiedUser();
    const client = newClient();
    const { accessToken } = await login(client, user);

    const res = await request(app)
      .delete(`/api/me/sessions/${sessionIdOf(accessToken)}`)
      .set(bearer(accessToken));
    expect(res.status).toBe(204);
    expect(refreshCookie(res)).toMatch(/refresh_token=;.*Path=\/api\/auth/);
    expect((await client.post('/api/auth/refresh')).status).toBe(401);
  });

  it('rejects a malformed session id', async () => {
    const user = await createVerifiedUser();
    const { accessToken } = await login(newClient(), user);
    const res = await request(app).delete('/api/me/sessions/not-a-uuid').set(bearer(accessToken));
    expect(res.status).toBe(400);
  });
});

describe('old routes', () => {
  it('no longer serve the device list under /auth', async () => {
    const user = await createVerifiedUser();
    const { accessToken } = await login(newClient(), user);
    expect((await request(app).get('/api/auth/sessions').set(bearer(accessToken))).status).toBe(
      404,
    );
  });
});
