import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '@/config/env';
import { ForbiddenException, UnauthorizedException } from '@/errors/http-exceptions';
import { sessionsRepository } from '@/repositories/sessions.repository';

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function tokensMatch(left: string, right: string) {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function tokenMatchesHash(token: string, expectedHash: string) {
  const expected = Buffer.from(expectedHash, 'hex');
  if (expected.length !== 32) return false;
  return timingSafeEqual(createHash('sha256').update(token).digest(), expected);
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const authorization = req.get('Authorization');
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/);
  const token = match?.[1];
  if (!token) {
    next(new UnauthorizedException());
    return;
  }

  const session = await sessionsRepository.findByAccessHash(hashToken(token));
  if (!session) {
    next(new UnauthorizedException('Invalid or expired access token'));
    return;
  }

  req.auth = { sessionId: session.id, userId: session.userId };
  next();
};

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const authorization = req.get('Authorization');
  if (!authorization) {
    next();
    return;
  }

  const match = authorization.match(/^Bearer ([A-Za-z0-9_-]+)$/);
  const token = match?.[1];
  if (!token) {
    next(new UnauthorizedException('Invalid or expired access token'));
    return;
  }

  const session = await sessionsRepository.findByAccessHash(hashToken(token));
  if (!session) {
    next(new UnauthorizedException('Invalid or expired access token'));
    return;
  }

  req.auth = { sessionId: session.id, userId: session.userId };
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
