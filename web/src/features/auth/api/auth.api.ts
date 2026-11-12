import { z } from 'zod';
import { apiRequest } from '@/shared/api/client';

const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  createdAt: z.string(),
});

const authResultSchema = z.object({
  user: userSchema,
  accessToken: z.string().min(1),
  expiresIn: z.number(),
});

const profileSchema = userSchema.extend({
  emailVerified: z.boolean(),
  hasPassword: z.boolean(),
  providers: z.array(z.string()),
});

const sessionSchema = z.object({
  id: z.string(),
  device: z.string(),
  userAgent: z.string(),
  ipAddress: z.string(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  expiresAt: z.string(),
  isCurrent: z.boolean(),
});

const messageSchema = z.object({ message: z.string() });

export type AuthUser = z.infer<typeof userSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type AuthResult = z.infer<typeof authResultSchema>;

export async function login(body: { email: string; password: string }): Promise<AuthResult> {
  const response = await apiRequest<unknown>('/auth/login', {
    method: 'POST',
    body,
    anonymous: true,
  });
  return authResultSchema.parse(response);
}

export async function register(body: {
  email: string;
  name: string;
  password: string;
}): Promise<string> {
  const response = await apiRequest<unknown>('/auth/register', {
    method: 'POST',
    body,
    anonymous: true,
  });
  return messageSchema.parse(response).message;
}

export async function requestEmailVerification(email: string): Promise<string> {
  const response = await apiRequest<unknown>('/auth/verify-email/request', {
    method: 'POST',
    body: { email },
    anonymous: true,
  });
  return messageSchema.parse(response).message;
}

export async function confirmEmailVerification(body: {
  email: string;
  code: string;
}): Promise<string> {
  const response = await apiRequest<unknown>('/auth/verify-email/confirm', {
    method: 'POST',
    body,
    anonymous: true,
  });
  return messageSchema.parse(response).message;
}

export async function requestPasswordReset(email: string): Promise<string> {
  const response = await apiRequest<unknown>('/auth/password-reset/request', {
    method: 'POST',
    body: { email },
    anonymous: true,
  });
  return messageSchema.parse(response).message;
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST' });
}

export async function logoutAll(): Promise<void> {
  await apiRequest<void>('/auth/logout-all', { method: 'POST' });
}

export async function getProfile(signal?: AbortSignal): Promise<Profile> {
  const response = await apiRequest<unknown>('/me', { signal });
  return z.object({ user: profileSchema }).parse(response).user;
}

export async function getSessions(signal?: AbortSignal): Promise<Session[]> {
  const response = await apiRequest<unknown>('/me/sessions', { signal });
  return z.object({ sessions: z.array(sessionSchema) }).parse(response).sessions;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await apiRequest<void>(`/me/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

export async function revokeOtherSessions(): Promise<void> {
  await apiRequest<void>('/me/sessions', { method: 'DELETE' });
}
