import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '@/config/env';
import { UnauthorizedException } from '@/errors/http-exceptions';

export const ACCESS_TTL_SECONDS = 5 * 60;
export const IDLE_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MAX_FAMILY_TTL_SECONDS = 30 * 24 * 60 * 60;

const ALGORITHM = 'HS256';

const accessClaimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
});

const refreshClaimsSchema = accessClaimsSchema.extend({
  jti: z.string().min(16).max(64),
  exp: z.number(),
});

export type AccessClaims = { userId: string; sessionId: string };
export type RefreshClaims = AccessClaims & { jti: string; expiresAt: number };

export class TokenService {
  signAccessToken({ userId, sessionId }: AccessClaims) {
    return jwt.sign({ sid: sessionId }, env.JWT_ACCESS_SECRET, {
      algorithm: ALGORITHM,
      subject: userId,
      audience: 'access',
      expiresIn: ACCESS_TTL_SECONDS,
    });
  }

  /** `expiresAt` is a Unix timestamp in seconds. */
  signRefreshToken({ userId, sessionId, jti, expiresAt }: RefreshClaims) {
    return jwt.sign({ sid: sessionId, jti, exp: expiresAt }, env.JWT_REFRESH_SECRET, {
      algorithm: ALGORITHM,
      subject: userId,
      audience: 'refresh',
    });
  }

  verifyAccessToken(token: string): AccessClaims {
    const claims = accessClaimsSchema.safeParse(
      this.verify(token, env.JWT_ACCESS_SECRET, 'access'),
    );
    if (!claims.success) throw new UnauthorizedException('Invalid or expired access token');
    return { userId: claims.data.sub, sessionId: claims.data.sid };
  }

  verifyRefreshToken(token: string): RefreshClaims {
    const claims = refreshClaimsSchema.safeParse(
      this.verify(token, env.JWT_REFRESH_SECRET, 'refresh'),
    );
    if (!claims.success) throw new UnauthorizedException('Invalid refresh credentials');
    return {
      userId: claims.data.sub,
      sessionId: claims.data.sid,
      jti: claims.data.jti,
      expiresAt: claims.data.exp,
    };
  }

  private verify(token: string, secret: string, audience: 'access' | 'refresh') {
    try {
      return jwt.verify(token, secret, { algorithms: [ALGORITHM], audience });
    } catch {
      throw new UnauthorizedException(
        audience === 'access' ? 'Invalid or expired access token' : 'Invalid refresh credentials',
      );
    }
  }
}

export const tokenService = new TokenService();
