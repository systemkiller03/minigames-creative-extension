import type { Response } from 'express';
import { env } from '@/config/env';

const cookieOptions = {
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

export function setAuthCookies(
  res: Response,
  refreshToken: string,
  csrfToken: string,
  refreshExpiresIn: number,
  path = '/auth',
) {
  res.cookie('refresh_token', refreshToken, {
    ...cookieOptions,
    path,
    httpOnly: true,
    maxAge: refreshExpiresIn,
  });
  setCsrfCookie(res, csrfToken, refreshExpiresIn, path);
}

export function setCsrfCookie(
  res: Response,
  csrfToken: string,
  refreshExpiresIn: number,
  path = '/auth',
) {
  res.cookie('csrf_token', csrfToken, {
    ...cookieOptions,
    path,
    httpOnly: false,
    maxAge: refreshExpiresIn,
  });
}

export function clearAuthCookies(res: Response, path = '/auth') {
  res.clearCookie('refresh_token', { ...cookieOptions, path, httpOnly: true });
  res.clearCookie('csrf_token', { ...cookieOptions, path, httpOnly: false });
}
