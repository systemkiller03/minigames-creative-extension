import argon2 from 'argon2';
import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@/errors/http-exceptions';
import { authIdentitiesRepository } from '@/repositories/auth-identities.repository';
import { sessionsRepository } from '@/repositories/sessions.repository';
import { usersRepository, type User } from '@/repositories/users.repository';
import type { ChangePasswordBody, UpdateProfileBody } from '@/schemas/me.schema';

function toProfile(user: User, providers: string[]) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerifiedAt !== null,
    hasPassword: user.passwordHash !== null,
    providers,
    createdAt: user.createdAt.toISOString(),
  };
}

export class MeService {
  async getProfile(userId: string) {
    const user = await usersRepository.findById(userId);
    // The access token outlives the account by up to 5 minutes (design O1).
    if (!user) throw new UnauthorizedException('Account no longer exists');
    return toProfile(user, await authIdentitiesRepository.listProviders(userId));
  }

  async updateProfile(userId: string, input: UpdateProfileBody) {
    const user = await usersRepository.updateName(userId, input.name);
    if (!user) throw new UnauthorizedException('Account no longer exists');
    return toProfile(user, await authIdentitiesRepository.listProviders(userId));
  }

  /** Ends every session, including the current one (design D8). */
  async changePassword(userId: string, input: ChangePasswordBody) {
    const user = await usersRepository.findById(userId);
    if (!user) throw new UnauthorizedException('Account no longer exists');
    if (!user.passwordHash) {
      throw new ConflictException('This account has no password. Use password reset to set one.');
    }
    // 403, not 401: a 401 would make the client try to refresh and loop.
    if (!(await argon2.verify(user.passwordHash, input.currentPassword))) {
      throw new ForbiddenException('Current password is incorrect');
    }

    await usersRepository.updatePasswordHash(userId, await argon2.hash(input.newPassword));
    await sessionsRepository.revokeAllForUser(userId);
  }

  /** "Log out everywhere else": every family except the current one. */
  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const families = await sessionsRepository.listForUser(userId);
    const others = families.filter((family) => family.id !== currentSessionId);
    await Promise.all(others.map((family) => sessionsRepository.revoke(family.id, userId)));
    return others.length;
  }
}

export const meService = new MeService();
