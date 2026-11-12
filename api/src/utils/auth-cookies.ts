import type { Request, Response } from 'express';
import { env } from '@/config/env';

const REFRESH_COOKIE = 'refresh_token';

const cookieOptions = {
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  httpOnly: true,
};

/** `refreshExpiresIn` is in milliseconds. `path` scopes the cookie to the auth routes. */
export function setRefreshCookie(
  res: Response,
  refreshToken: string,
  refreshExpiresIn: number,
  path = '/auth',
) {
  res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions, path, maxAge: refreshExpiresIn });
}

export function clearRefreshCookie(res: Response, path = '/auth') {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, path });
}

/** Cookie path from a route outside the auth router (e.g. /api/me -> /api/auth). */
export function authCookiePathFrom(req: Request) {
  return req.baseUrl.replace(/\/[^/]+$/, '/auth');
}

export { REFRESH_COOKIE };
