import argon2 from 'argon2';
import { randomBytes, randomUUID } from 'node:crypto';
import { usersRepository, type User } from '@/repositories/users.repository';
import { EmailNotVerifiedException, UnauthorizedException } from '@/errors/http-exceptions';
import type { RegisterBody } from '@/schemas/register.schema';
import type { LoginBody } from '@/schemas/login.schema';
import { RotateResult, sessionsRepository } from '@/repositories/sessions.repository';
import {
  authIdentitiesRepository,
  type GoogleProfile,
} from '@/repositories/auth-identities.repository';
import { emailVerificationService } from '@/services/email-verification.service';
import {
  ACCESS_TTL_SECONDS,
  IDLE_TTL_SECONDS,
  MAX_FAMILY_TTL_SECONDS,
  tokenService,
} from '@/services/token.service';

const IDLE_TTL_MS = IDLE_TTL_SECONDS * 1000;
const MAX_FAMILY_TTL_MS = MAX_FAMILY_TTL_SECONDS * 1000;
/** A just-rotated refresh token is still accepted for this long (two tabs refreshing at once). */
const REFRESH_GRACE_MS = 20 * 1000;
let dummyPasswordHash: Promise<string> | undefined;

type SessionMetadata = {
  userAgent: string;
  ipAddress: string;
};

function createJti() {
  return randomBytes(24).toString('base64url');
}

export class AuthService {
  /**
   * Always resolves the same way, whether or not the email is already registered, so the
   * response cannot be used to discover which emails have accounts.
   */
  async register(input: RegisterBody) {
    const passwordHash = await argon2.hash(input.password);
    const user = await usersRepository.insert({
      email: input.email,
      name: input.name,
      passwordHash,
    });
    if (user) void emailVerificationService.issueCode(user.id, user.email);
  }

  async login(input: LoginBody, metadata: SessionMetadata) {
    const user = await usersRepository.findByEmail(input.email);
    let passwordHash = user?.passwordHash;
    if (!passwordHash) {
      dummyPasswordHash ??= argon2.hash(randomBytes(32).toString('hex'));
      passwordHash = await dummyPasswordHash;
    }
    if (!(await argon2.verify(passwordHash, input.password)) || !user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    // Checked only after the password is proven, so this does not reveal which emails exist.
    if (!user.emailVerifiedAt) throw new EmailNotVerifiedException();

    return this.createSession(user, metadata);
  }

  async loginWithGoogle(profile: GoogleProfile, metadata: SessionMetadata) {
    const user = await authIdentitiesRepository.findOrCreateGoogleUser(profile);
    return this.createSession(user, metadata);
  }

  async refresh(refreshToken: string | undefined, metadata: SessionMetadata) {
    if (!refreshToken) throw new UnauthorizedException('Invalid refresh credentials');
    const claims = tokenService.verifyRefreshToken(refreshToken);

    const now = Date.now();
    const newJti = createJti();
    const rotation = await sessionsRepository.rotate({
      id: claims.sessionId,
      userId: claims.userId,
      presentedJti: claims.jti,
      newJti,
      now,
      graceMs: REFRESH_GRACE_MS,
      idleMs: IDLE_TTL_MS,
      userAgent: metadata.userAgent.slice(0, 512),
      ipAddress: metadata.ipAddress,
    });
    if (rotation.result !== RotateResult.Rotated) {
      throw new UnauthorizedException(
        rotation.result === RotateResult.Reuse
          ? 'Refresh token reuse detected; sign in again'
          : 'Invalid refresh credentials',
      );
    }

    const user = await usersRepository.findById(claims.userId);
    if (!user) {
      await sessionsRepository.revoke(claims.sessionId, claims.userId);
      throw new UnauthorizedException('Account no longer exists');
    }
    return {
      user: this.toPublicUser(user),
      ...this.issueTokens(user.id, claims.sessionId, {
        jti: newJti,
        expiresAt: rotation.expiresAt,
        now,
      }),
    };
  }

  async logout(userId: string, sessionId: string) {
    await sessionsRepository.revoke(sessionId, userId);
  }

  private async createSession(user: User, metadata: SessionMetadata) {
    const now = Date.now();
    const sessionId = randomUUID();
    const jti = createJti();
    const maxExpiresAt = now + MAX_FAMILY_TTL_MS;
    await sessionsRepository.create({
      id: sessionId,
      userId: user.id,
      jti,
      now,
      maxExpiresAt,
      idleMs: IDLE_TTL_MS,
      userAgent: metadata.userAgent.slice(0, 512),
      ipAddress: metadata.ipAddress,
    });
    return {
      user: this.toPublicUser(user),
      ...this.issueTokens(user.id, sessionId, {
        jti,
        expiresAt: Math.min(now + IDLE_TTL_MS, maxExpiresAt),
        now,
      }),
    };
  }

  private issueTokens(
    userId: string,
    sessionId: string,
    refresh: { jti: string; expiresAt: number; now: number },
  ) {
    return {
      accessToken: tokenService.signAccessToken({ userId, sessionId }),
      expiresIn: ACCESS_TTL_SECONDS,
      refreshToken: tokenService.signRefreshToken({
        userId,
        sessionId,
        jti: refresh.jti,
        expiresAt: Math.floor(refresh.expiresAt / 1000),
      }),
      refreshExpiresIn: Math.max(0, refresh.expiresAt - refresh.now),
    };
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
