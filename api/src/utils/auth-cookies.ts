import type { Response } from 'express';
import { env } from '@/config/env';

const cookieOptions = {
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/auth',
};

export function setAuthCookies(
  res: Response,
  refreshToken: string,
  csrfToken: string,
  refreshExpiresIn: number,
) {
  res.cookie('refresh_token', refreshToken, {
    ...cookieOptions,
    httpOnly: true,
    maxAge: refreshExpiresIn,
  });
  setCsrfCookie(res, csrfToken, refreshExpiresIn);
}

export function setCsrfCookie(res: Response, csrfToken: string, refreshExpiresIn: number) {
  res.cookie('csrf_token', csrfToken, {
    ...cookieOptions,
    httpOnly: false,
    maxAge: refreshExpiresIn,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('refresh_token', { ...cookieOptions, httpOnly: true });
  res.clearCookie('csrf_token', { ...cookieOptions, httpOnly: false });
}
