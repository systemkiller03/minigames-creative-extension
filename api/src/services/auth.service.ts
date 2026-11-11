import argon2 from 'argon2';
import { randomBytes, randomUUID } from 'node:crypto';
import { usersRepository, type User } from '@/repositories/users.repository';
import { ConflictException, UnauthorizedException } from '@/errors/http-exceptions';
import { hashToken, tokenMatchesHash, tokensMatch } from '@/middlewares/auth.middleware';
import type { RegisterBody } from '@/schemas/register.schema';
import type { LoginBody } from '@/schemas/login.schema';
import { sessionsRepository } from '@/repositories/sessions.repository';
import {
  authIdentitiesRepository,
  type GoogleProfile,
} from '@/repositories/auth-identities.repository';

const ACCESS_TTL_SECONDS = 15 * 60;
const IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
let dummyPasswordHash: Promise<string> | undefined;

type SessionMetadata = {
  userAgent: string;
  ipAddress: string;
};

function createToken() {
  return randomBytes(32).toString('base64url');
}

export class AuthService {
  async register(input: RegisterBody) {
    const passwordHash = await argon2.hash(input.password);
    const user = await usersRepository.insert({
      email: input.email,
      name: input.name,
      passwordHash,
    });
    if (!user) throw new ConflictException('Email is already registered');
    return this.toPublicUser(user);
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

    return this.createSession(user, metadata);
  }

  async loginWithGoogle(profile: GoogleProfile, metadata: SessionMetadata) {
    const user = await authIdentitiesRepository.findOrCreateGoogleUser(profile);
    return this.createSession(user, metadata);
  }

  async refresh(
    refreshToken: string | undefined,
    csrfCookie: string | undefined,
    csrfHeader: string | undefined,
    metadata: SessionMetadata,
  ) {
    if (!refreshToken || !csrfCookie || !csrfHeader || !tokensMatch(csrfCookie, csrfHeader)) {
      throw new UnauthorizedException('Invalid refresh credentials');
    }

    const presentedRefreshHash = hashToken(refreshToken);
    const session = await sessionsRepository.findByRefreshHash(presentedRefreshHash);
    if (!session) {
      throw new UnauthorizedException('Invalid refresh credentials');
    }
    const expectedCsrfHash = await sessionsRepository.findCsrfHash(
      session.id,
      presentedRefreshHash,
    );
    if (!expectedCsrfHash || !tokenMatchesHash(csrfCookie, expectedCsrfHash)) {
      throw new UnauthorizedException('Invalid refresh credentials');
    }

    const now = Date.now();
    const accessToken = createToken();
    const nextRefreshToken = createToken();
    const csrfToken = createToken();
    const result = await sessionsRepository.rotate({
      session,
      presentedRefreshHash,
      now,
      idleExpiresAt: Math.min(now + IDLE_TTL_MS, session.maxExpiresAt),
      refreshHash: hashToken(nextRefreshToken),
      accessHash: hashToken(accessToken),
      csrfHash: hashToken(csrfToken),
      accessTtlSeconds: ACCESS_TTL_SECONDS,
      userAgent: metadata.userAgent.slice(0, 512),
      ipAddress: metadata.ipAddress,
    });

    if (result !== 1) {
      throw new UnauthorizedException(
        result === -1
          ? 'Refresh token reuse detected; sign in again'
          : 'Invalid refresh credentials',
      );
    }

    const user = await usersRepository.findById(session.userId);
    if (!user) {
      await sessionsRepository.revoke(session.id, session.userId);
      throw new UnauthorizedException('Account no longer exists');
    }
    return {
      user: this.toPublicUser(user),
      accessToken,
      expiresIn: ACCESS_TTL_SECONDS,
      refreshToken: nextRefreshToken,
      csrfToken,
      refreshExpiresIn: Math.max(0, session.maxExpiresAt - now),
    };
  }

  async issueCsrfToken(refreshToken: string | undefined) {
    if (!refreshToken) throw new UnauthorizedException('Invalid refresh credentials');
    const refreshHash = hashToken(refreshToken);
    const session = await sessionsRepository.findByRefreshHash(refreshHash);
    if (!session || session.currentRefreshHash !== refreshHash) {
      throw new UnauthorizedException('Invalid refresh credentials');
    }

    const csrfToken = createToken();
    const updated = await sessionsRepository.updateCsrf(session, hashToken(csrfToken));
    if (!updated) throw new UnauthorizedException('Invalid refresh credentials');
    return {
      csrfToken,
      refreshExpiresIn: Math.max(0, session.maxExpiresAt - Date.now()),
    };
  }

  private async createSession(user: User, metadata: SessionMetadata) {
    const now = Date.now();
    const maxExpiresAt = now + MAX_SESSION_TTL_MS;
    const refreshToken = createToken();
    const accessToken = createToken();
    const csrfToken = createToken();
    await sessionsRepository.create({
      id: randomUUID(),
      userId: user.id,
      now,
      idleExpiresAt: Math.min(now + IDLE_TTL_MS, maxExpiresAt),
      maxExpiresAt,
      userAgent: metadata.userAgent.slice(0, 512),
      ipAddress: metadata.ipAddress,
      refreshHash: hashToken(refreshToken),
      accessHash: hashToken(accessToken),
      csrfHash: hashToken(csrfToken),
      accessTtlSeconds: ACCESS_TTL_SECONDS,
    });
    return {
      user: this.toPublicUser(user),
      accessToken,
      expiresIn: ACCESS_TTL_SECONDS,
      refreshToken,
      csrfToken,
      refreshExpiresIn: MAX_SESSION_TTL_MS,
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
