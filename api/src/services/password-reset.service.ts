import argon2 from 'argon2';
import { randomBytes, randomInt } from 'node:crypto';
import { UnauthorizedException } from '@/errors/http-exceptions';
import { hashToken, tokenMatchesHash } from '@/middlewares/auth.middleware';
import { redis } from '@/providers/redis';
import { usersRepository } from '@/repositories/users.repository';
import type {
  PasswordResetConfirm,
  PasswordResetRequest,
  PasswordResetVerify,
} from '@/schemas/password-reset.schema';
import { emailService } from '@/services/email.service';
import { sessionsRepository } from '@/repositories/sessions.repository';

const RESET_TTL_SECONDS = 10 * 60;
const RESET_KEY_PREFIX = 'auth:password-reset:request:';
const compareAndSetScript = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  return 1
`;
const deleteIfMatchesScript = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
  return redis.call('DEL', KEYS[1])
`;

type ResetChallenge = {
  userId: string;
  codeHash?: string;
  resetTokenHash?: string;
};

function resetKey(email: string) {
  return `${RESET_KEY_PREFIX}${hashToken(email)}`;
}

function parseChallenge(value: string | null): ResetChallenge | null {
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('userId' in parsed) ||
    typeof parsed.userId !== 'string'
  ) {
    throw new Error('Stored password reset challenge is malformed');
  }

  const codeHash =
    'codeHash' in parsed && typeof parsed.codeHash === 'string' ? parsed.codeHash : undefined;
  const resetTokenHash =
    'resetTokenHash' in parsed && typeof parsed.resetTokenHash === 'string'
      ? parsed.resetTokenHash
      : undefined;
  return {
    userId: parsed.userId,
    ...(codeHash && { codeHash }),
    ...(resetTokenHash && { resetTokenHash }),
  };
}

function safeErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return typeof error.code === 'string' ? error.code : 'unknown';
  }
  return error instanceof Error ? error.name : 'unknown';
}

export class PasswordResetService {
  async requestCode(input: PasswordResetRequest) {
    try {
      const user = await usersRepository.findByEmail(input.email);
      if (!user) return;

      const code = String(randomInt(0, 100_000_000)).padStart(8, '0');
      const challenge: ResetChallenge = {
        userId: user.id,
        codeHash: hashToken(code),
      };
      const key = resetKey(input.email);
      await redis.set(key, JSON.stringify(challenge), 'EX', RESET_TTL_SECONDS);
      await emailService.sendPasswordResetCode(input.email, code);
    } catch (error) {
      console.error('Password reset request processing failed', safeErrorCode(error));
    }
  }

  async verifyCode(input: PasswordResetVerify) {
    const key = resetKey(input.email);
    const stored = await redis.get(key);
    const challenge = parseChallenge(stored);

    if (!stored || !challenge?.codeHash || !tokenMatchesHash(input.code, challenge.codeHash)) {
      throw new UnauthorizedException('Invalid or expired reset code');
    }

    const ttl = await redis.ttl(key);
    if (ttl < 1) throw new UnauthorizedException('Invalid or expired reset code');

    const resetToken = randomBytes(32).toString('base64url');
    const verifiedChallenge: ResetChallenge = {
      userId: challenge.userId,
      resetTokenHash: hashToken(resetToken),
    };
    const consumed = await redis.eval(
      compareAndSetScript,
      1,
      key,
      stored,
      JSON.stringify(verifiedChallenge),
      String(ttl),
    );
    if (Number(consumed) !== 1) {
      throw new UnauthorizedException('Invalid or expired reset code');
    }

    return resetToken;
  }

  async confirm(input: PasswordResetConfirm) {
    const key = resetKey(input.email);
    const stored = await redis.get(key);
    const challenge = parseChallenge(stored);

    if (
      !stored ||
      !challenge?.resetTokenHash ||
      !tokenMatchesHash(input.resetToken, challenge.resetTokenHash)
    ) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(input.newPassword);
    const consumed = await redis.eval(deleteIfMatchesScript, 1, key, stored);
    if (Number(consumed) !== 1) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    await sessionsRepository.revokeAllForUser(challenge.userId);
    const updated = await usersRepository.updatePasswordHash(challenge.userId, passwordHash);
    if (!updated) throw new UnauthorizedException('Account no longer exists');
  }

  /** Drops any pending reset challenge for this email (used when the account is deleted). */
  async discard(email: string) {
    await redis.del(resetKey(email));
  }
}

export const passwordResetService = new PasswordResetService();
