import { randomInt } from 'node:crypto';
import { UnauthorizedException } from '@/errors/http-exceptions';
import { hashToken, tokenMatchesHash } from '@/middlewares/auth.middleware';
import { redis } from '@/providers/redis';
import { usersRepository } from '@/repositories/users.repository';
import type {
  EmailVerificationConfirm,
  EmailVerificationRequest,
} from '@/schemas/email-verification.schema';
import { emailService } from '@/services/email.service';

const CODE_TTL_SECONDS = 10 * 60;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_WRONG_ATTEMPTS = 5;
const KEY_PREFIX = 'auth:email-verify:';

type Challenge = {
  userId: string;
  codeHash: string;
  attempts: number;
  issuedAt: number;
};

// Only replaces the stored challenge if nobody changed it since we read it.
const replaceIfUnchangedScript = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
  redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
  return 1
`;
const deleteIfUnchangedScript = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
  return redis.call('DEL', KEYS[1])
`;

function challengeKey(email: string) {
  return `${KEY_PREFIX}${hashToken(email)}`;
}

function parseChallenge(value: string | null): Challenge | null {
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('userId' in parsed) ||
    typeof parsed.userId !== 'string' ||
    !('codeHash' in parsed) ||
    typeof parsed.codeHash !== 'string' ||
    !('attempts' in parsed) ||
    typeof parsed.attempts !== 'number' ||
    !('issuedAt' in parsed) ||
    typeof parsed.issuedAt !== 'number'
  ) {
    throw new Error('Stored email verification challenge is malformed');
  }
  return {
    userId: parsed.userId,
    codeHash: parsed.codeHash,
    attempts: parsed.attempts,
    issuedAt: parsed.issuedAt,
  };
}

function safeErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return typeof error.code === 'string' ? error.code : 'unknown';
  }
  return error instanceof Error ? error.name : 'unknown';
}

export class EmailVerificationService {
  /**
   * Creates and emails a fresh code. No-op if a code was issued less than a minute ago.
   * Failures are logged, never thrown: callers answer the client before this finishes.
   */
  async issueCode(userId: string, email: string) {
    try {
      const key = challengeKey(email);
      const existing = parseChallenge(await redis.get(key));
      if (existing && Date.now() - existing.issuedAt < RESEND_COOLDOWN_MS) return;

      const code = String(randomInt(0, 100_000_000)).padStart(8, '0');
      const challenge: Challenge = {
        userId,
        codeHash: hashToken(code),
        attempts: 0,
        issuedAt: Date.now(),
      };
      await redis.set(key, JSON.stringify(challenge), 'EX', CODE_TTL_SECONDS);
      await emailService.sendEmailVerificationCode(email, code);
    } catch (error) {
      console.error('Email verification code processing failed', safeErrorCode(error));
    }
  }

  async requestCode(input: EmailVerificationRequest) {
    const user = await usersRepository.findByEmail(input.email);
    if (!user || user.emailVerifiedAt) return;
    await this.issueCode(user.id, user.email);
  }

  async confirm(input: EmailVerificationConfirm) {
    const key = challengeKey(input.email);
    const stored = await redis.get(key);
    const challenge = parseChallenge(stored);
    if (!stored || !challenge) throw new UnauthorizedException('Invalid or expired code');

    if (!tokenMatchesHash(input.code, challenge.codeHash)) {
      const attempts = challenge.attempts + 1;
      if (attempts >= MAX_WRONG_ATTEMPTS) {
        await redis.eval(deleteIfUnchangedScript, 1, key, stored);
      } else {
        await redis.eval(
          replaceIfUnchangedScript,
          1,
          key,
          stored,
          JSON.stringify({ ...challenge, attempts }),
        );
      }
      throw new UnauthorizedException('Invalid or expired code');
    }

    // Single use: only the request that deletes the challenge may verify the account.
    const consumed = await redis.eval(deleteIfUnchangedScript, 1, key, stored);
    if (Number(consumed) !== 1) throw new UnauthorizedException('Invalid or expired code');

    const verified = await usersRepository.markEmailVerified(challenge.userId);
    if (!verified) throw new UnauthorizedException('Invalid or expired code');
  }
}

export const emailVerificationService = new EmailVerificationService();
