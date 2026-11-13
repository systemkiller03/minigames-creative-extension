import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '@/test/utils';
import * as api from './auth.api';

const fetchMock = vi.fn();
const user = { id: '1', email: 'a@b.co', name: 'Ann', createdAt: '2026-01-01' };

beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function lastCall() {
  const index = fetchMock.mock.calls.length - 1;
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, method: init.method, body: init.body };
}

describe('auth api', () => {
  it('logs in', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user, accessToken: 't', expiresIn: 900 }));
    expect((await api.login({ email: 'a@b.co', password: 'x' })).accessToken).toBe('t');
    expect(lastCall().url).toBe('/api/auth/login');
  });

  it('handles message-returning endpoints', async () => {
    const message = jsonResponse({ message: 'ok' });
    fetchMock.mockImplementation(() => Promise.resolve(message.clone()));
    expect(await api.register({ email: 'a@b.co', name: 'Ann', password: 'password1' })).toBe('ok');
    expect(await api.requestEmailVerification('a@b.co')).toBe('ok');
    expect(await api.confirmEmailVerification({ email: 'a@b.co', code: '12345678' })).toBe('ok');
    expect(await api.requestPasswordReset('a@b.co')).toBe('ok');
    expect(
      await api.confirmPasswordReset({
        email: 'a@b.co',
        resetToken: 't',
        newPassword: 'password1',
      }),
    ).toBe('ok');
  });

  it('verifies a password reset code', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ resetToken: 'rt' }));
    expect(await api.verifyPasswordReset({ email: 'a@b.co', code: '12345678' })).toBe('rt');
  });

  it('reads profile, sessions and updates the profile', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ user: { ...user, emailVerified: true, hasPassword: true, providers: [] } }),
    );
    expect((await api.getProfile()).emailVerified).toBe(true);

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        sessions: [
          {
            id: 's',
            device: 'd',
            userAgent: 'u',
            ipAddress: 'i',
            createdAt: 'c',
            lastSeenAt: 'l',
            expiresAt: 'e',
            isCurrent: true,
          },
        ],
      }),
    );
    expect(await api.getSessions()).toHaveLength(1);

    fetchMock.mockResolvedValueOnce(jsonResponse({ user }));
    expect((await api.updateProfile({ name: 'Ann' })).name).toBe('Ann');
    expect(lastCall().method).toBe('PATCH');
  });

  it('calls void endpoints with the right verb and path', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
    await api.logout();
    expect(lastCall()).toMatchObject({ url: '/api/auth/logout', method: 'POST' });
    await api.logoutAll();
    expect(lastCall().url).toBe('/api/auth/logout-all');
    await api.revokeSession('a/b');
    expect(lastCall()).toMatchObject({ url: '/api/me/sessions/a%2Fb', method: 'DELETE' });
    await api.revokeOtherSessions();
    expect(lastCall().url).toBe('/api/me/sessions');
    await api.changePassword({ currentPassword: 'a', newPassword: 'b' });
    expect(lastCall().url).toBe('/api/me/password');
    await api.deleteAccount({ confirm: true });
    expect(lastCall()).toMatchObject({ url: '/api/auth/account', method: 'DELETE' });
  });
});
