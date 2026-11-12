import { randomBytes, randomInt } from 'node:crypto';
import request from 'supertest';
import { expect, vi } from 'vitest';
import { createApp } from '@/app';
import { pool, closeDb } from '@/providers/db';
import { redis, closeRedis } from '@/providers/redis';
import { sessionsRepository } from '@/repositories/sessions.repository';

export const app = createApp();
export const ORIGIN = 'http://localhost:5173';
export const PASSWORD = 'Correct-Horse-9';

export const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
export const FIREFOX_LINUX =
  'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';

const EMAIL_DOMAIN = 'example.test';
const EMAIL_PREFIX = 'it-';

type Mail = { kind: 'verify' | 'reset'; email: string; code: string };
const outbox = (globalThis as unknown as { __outbox: Mail[] }).__outbox;

export const uniqueEmail = () => `${EMAIL_PREFIX}${randomBytes(6).toString('hex')}@${EMAIL_DOMAIN}`;

/**
 * A browser: its own cookie jar, User-Agent and client IP. `trust proxy` is 2, so the
 * client address is the second-to-last X-Forwarded-For entry. A fresh IP per client keeps
 * the per-IP rate limits of different tests from interfering.
 */
export function newClient(userAgent = CHROME_WINDOWS) {
  const ip = `10.${randomInt(0, 256)}.${randomInt(0, 256)}.${randomInt(1, 255)}`;
  return request
    .agent(app)
    .set('X-Forwarded-For', `${ip}, 10.0.0.1`)
    .set('User-Agent', userAgent)
    .set('Origin', ORIGIN);
}
export type Client = ReturnType<typeof newClient>;

/** Latest email of this kind sent to this address (emails are sent after the response). */
export async function waitForMail(kind: Mail['kind'], email: string, afterCount = 0) {
  return vi.waitFor(
    () => {
      const mails = outbox.filter((mail) => mail.kind === kind && mail.email === email);
      expect(mails.length).toBeGreaterThan(afterCount);
      return mails[mails.length - 1]!.code;
    },
    { timeout: 5000, interval: 25 },
  );
}

export function mailCount(kind: Mail['kind'], email: string) {
  return outbox.filter((mail) => mail.kind === kind && mail.email === email).length;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Registers, reads the emailed code and confirms it. */
export async function createVerifiedUser(email = uniqueEmail(), password = PASSWORD) {
  const client = newClient();
  const registered = await client
    .post('/api/auth/register')
    .send({ email, name: 'Test User', password });
  expect(registered.status).toBe(201);
  const code = await waitForMail('verify', email);
  const confirmed = await client.post('/api/auth/verify-email/confirm').send({ email, code });
  expect(confirmed.status).toBe(200);
  return { email, password };
}

export async function register(email = uniqueEmail(), password = PASSWORD) {
  const res = await newClient()
    .post('/api/auth/register')
    .send({ email, name: 'Test User', password });
  expect(res.status).toBe(201);
  return { email, password };
}

/** Logs in on `client` (which stores the refresh cookie) and returns the response body. */
export async function login(client: Client, creds: { email: string; password: string }) {
  const res = await client.post('/api/auth/login').send(creds);
  expect(res.status).toBe(200);
  return res.body as {
    user: { id: string; email: string };
    accessToken: string;
    expiresIn: number;
  };
}

/** Value of the refresh_token cookie set by a response (or undefined). */
export function refreshCookie(res: { headers: Record<string, unknown> }) {
  const header = res.headers['set-cookie'];
  const cookies = Array.isArray(header) ? (header as string[]) : [];
  return cookies.find((cookie) => cookie.startsWith('refresh_token='));
}

export function refreshCookieValue(res: { headers: Record<string, unknown> }) {
  return refreshCookie(res)?.split(';')[0]?.slice('refresh_token='.length);
}

/** Sends a refresh with an explicit cookie value and no cookie jar. */
export function refreshWith(token: string) {
  return request(app)
    .post('/api/auth/refresh')
    .set('Origin', ORIGIN)
    .set('X-Forwarded-For', `10.${randomInt(0, 256)}.${randomInt(0, 256)}.9, 10.0.0.1`)
    .set('Cookie', `refresh_token=${token}`);
}

/** Session id carried in an access token. */
export function sessionIdOf(accessToken: string) {
  const payload = JSON.parse(Buffer.from(accessToken.split('.')[1]!, 'base64url').toString());
  return payload.sid as string;
}

export async function cleanup() {
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM users WHERE email LIKE $1`, [
    `${EMAIL_PREFIX}%@${EMAIL_DOMAIN}`,
  ]);
  for (const row of rows) await sessionsRepository.revokeAllForUser(row.id);
  await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`${EMAIL_PREFIX}%@${EMAIL_DOMAIN}`]);
}

export async function closeConnections() {
  await cleanup();
  await Promise.allSettled([closeDb(), closeRedis()]);
}

export { redis, pool };
