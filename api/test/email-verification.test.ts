import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { emailVerificationService } from '@/services/email-verification.service';
import {
  PASSWORD,
  closeConnections,
  createVerifiedUser,
  login,
  mailCount,
  newClient,
  register,
  sleep,
  uniqueEmail,
  waitForMail,
} from './helpers';

afterAll(closeConnections);
afterEach(() => vi.useRealTimers());

describe('registration', () => {
  it('creates an unverified account and emails a code, without returning the user', async () => {
    const email = uniqueEmail();
    const res = await newClient()
      .post('/api/auth/register')
      .send({ email, name: 'Test User', password: PASSWORD });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(['message']);
    expect(await waitForMail('verify', email)).toMatch(/^\d{8}$/);
  });

  it('answers a duplicate registration identically and sends nothing', async () => {
    const email = uniqueEmail();
    const first = await newClient()
      .post('/api/auth/register')
      .send({ email, name: 'Test User', password: PASSWORD });
    await waitForMail('verify', email);

    const second = await newClient()
      .post('/api/auth/register')
      .send({ email, name: 'Someone Else', password: 'Another-Pass-1' });
    await sleep(300);

    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    expect(mailCount('verify', email)).toBe(1);
  });

  it('does the same for an already verified account', async () => {
    const { email } = await createVerifiedUser();
    const before = mailCount('verify', email);

    const res = await newClient()
      .post('/api/auth/register')
      .send({ email, name: 'Test User', password: 'Another-Pass-1' });
    await sleep(300);

    expect(res.status).toBe(201);
    expect(mailCount('verify', email)).toBe(before);
  });

  it('rejects invalid input', async () => {
    const res = await newClient()
      .post('/api/auth/register')
      .send({ email: 'not-an-email', name: 'x', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('login before verification', () => {
  it('returns 403 EMAIL_NOT_VERIFIED when the password is right', async () => {
    const { email, password } = await register();
    const res = await newClient().post('/api/auth/login').send({ email, password });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('does not reveal the unverified state when the password is wrong', async () => {
    const { email } = await register();
    const unverified = await newClient()
      .post('/api/auth/login')
      .send({ email, password: 'Wrong-Password-1' });
    const unknown = await newClient()
      .post('/api/auth/login')
      .send({ email: uniqueEmail(), password: 'Wrong-Password-1' });

    expect(unverified.status).toBe(401);
    expect(unverified.body).toEqual(unknown.body);
  });
});

describe('confirming the code', () => {
  it('verifies the account so that login works', async () => {
    const { email, password } = await createVerifiedUser();
    const body = await login(newClient(), { email, password });
    expect(body.user.email).toBe(email);
  });

  it('rejects a wrong code and an unknown email with the same answer', async () => {
    const { email } = await register();
    await waitForMail('verify', email);

    const wrong = await newClient()
      .post('/api/auth/verify-email/confirm')
      .send({ email, code: '00000000' });
    const unknown = await newClient()
      .post('/api/auth/verify-email/confirm')
      .send({ email: uniqueEmail(), code: '00000000' });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('makes a code single-use', async () => {
    const { email } = await register();
    const code = await waitForMail('verify', email);
    const client = newClient();

    expect((await client.post('/api/auth/verify-email/confirm').send({ email, code })).status).toBe(
      200,
    );
    expect((await client.post('/api/auth/verify-email/confirm').send({ email, code })).status).toBe(
      401,
    );
  });

  it('invalidates the code after five wrong attempts', async () => {
    const { email } = await register();
    const code = await waitForMail('verify', email);
    const wrongCode = code === '11111111' ? '22222222' : '11111111';
    const input = (value: string) => ({ email, code: value });

    // Called on the service directly: the HTTP rate limiter would stop us first.
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(emailVerificationService.confirm(input(wrongCode))).rejects.toThrow();
    }
    await expect(emailVerificationService.confirm(input(code))).rejects.toThrow();
  });

  it('rate limits confirmation attempts over HTTP', async () => {
    const { email } = await register();
    const client = newClient();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await client
        .post('/api/auth/verify-email/confirm')
        .send({ email, code: '00000000' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });
});

describe('requesting a new code', () => {
  it('gives the same generic answer for unknown and unverified emails', async () => {
    const { email } = await register();
    const known = await newClient().post('/api/auth/verify-email/request').send({ email });
    const unknown = await newClient()
      .post('/api/auth/verify-email/request')
      .send({ email: uniqueEmail() });

    expect(known.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it('does not send a second code within the one-minute cooldown, but does after it', async () => {
    const { email } = await register();
    await waitForMail('verify', email);

    await newClient().post('/api/auth/verify-email/request').send({ email });
    await sleep(300);
    expect(mailCount('verify', email)).toBe(1);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 61_000);
    await newClient().post('/api/auth/verify-email/request').send({ email });
    // The code is issued after the response, so keep the clock moved until it arrives.
    const newCode = await waitForMail('verify', email, 1);
    vi.useRealTimers();
    expect(newCode).toMatch(/^\d{8}$/);
    const res = await newClient()
      .post('/api/auth/verify-email/confirm')
      .send({ email, code: newCode });
    expect(res.status).toBe(200);
  });

  it('sends nothing for an already verified account', async () => {
    const { email } = await createVerifiedUser();
    const before = mailCount('verify', email);
    const res = await newClient().post('/api/auth/verify-email/request').send({ email });
    await sleep(300);

    expect(res.status).toBe(200);
    expect(mailCount('verify', email)).toBe(before);
  });
});
