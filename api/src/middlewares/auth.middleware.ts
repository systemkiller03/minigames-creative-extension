import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '@/config/env';
import { ForbiddenException, UnauthorizedException } from '@/errors/http-exceptions';
import { tokenService } from '@/services/token.service';

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenMatchesHash(token: string, expectedHash: string) {
  const expected = Buffer.from(expectedHash, 'hex');
  if (expected.length !== 32) return false;
  return timingSafeEqual(createHash('sha256').update(token).digest(), expected);
}

function readBearerToken(authorization: string | undefined) {
  return authorization?.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1];
}

/** Verifies the access JWT by signature and expiry only; nothing is looked up. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readBearerToken(req.get('Authorization'));
  if (!token) {
    next(new UnauthorizedException());
    return;
  }

  req.auth = tokenService.verifyAccessToken(token);
  next();
};

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const authorization = req.get('Authorization');
  if (!authorization) {
    next();
    return;
  }

  const token = readBearerToken(authorization);
  if (!token) {
    next(new UnauthorizedException('Invalid or expired access token'));
    return;
  }

  req.auth = tokenService.verifyAccessToken(token);
  next();
};

export function getAuthContext(req: Express.Request) {
  if (!req.auth) throw new UnauthorizedException();
  return req.auth;
}

export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.get('Origin');
  if (!origin || !env.CORS_ORIGINS.includes(origin)) {
    next(new ForbiddenException('Origin is not allowed'));
    return;
  }
  next();
};
