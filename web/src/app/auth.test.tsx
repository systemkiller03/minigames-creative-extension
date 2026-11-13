import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installBackend, renderApp, USER, type Handler } from '@/test/app';
import { jsonResponse } from '@/test/utils';
import { setAccessToken } from '@/shared/api/client';

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

const loginOk: Handler = (url, init) =>
  url.pathname === '/api/auth/login' && init.method === 'POST'
    ? jsonResponse({ user: USER, accessToken: 'token', expiresIn: 900 })
    : undefined;

async function openLogin() {
  const { router } = await renderApp('/?auth=login');
  const dialog = await screen.findByRole('dialog', { name: /Welcome Back/u });
  return { router, dialog };
}

describe('login', () => {
  it('validates, then signs in and shows a welcome message', async () => {
    installBackend({ handlers: [loginOk] });
    const { router, dialog } = await openLogin();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Login' }));
    expect(await within(dialog).findAllByRole('alert')).not.toHaveLength(0);

    await userEvent.type(within(dialog).getByLabelText('Email Address'), 'ann@example.com');
    await userEvent.type(within(dialog).getByLabelText('Password'), 'password1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Show password' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Login' }));
    expect(await screen.findByText('Welcome back, Ann!')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('auth'));
  });

  it('shows an error for wrong credentials', async () => {
    installBackend({
      handlers: [
        (url) =>
          url.pathname === '/api/auth/login'
            ? jsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'bad' } }, 401)
            : undefined,
      ],
    });
    const { dialog } = await openLogin();
    await userEvent.type(within(dialog).getByLabelText('Email Address'), 'ann@example.com');
    await userEvent.type(within(dialog).getByLabelText('Password'), 'wrong');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Login' }));
    expect(await within(dialog).findByText('Incorrect email or password.')).toBeInTheDocument();
  });

  it('shows a generic error on server failure', async () => {
    installBackend({
      handlers: [(url) => (url.pathname === '/api/auth/login' ? jsonResponse({}, 500) : undefined)],
    });
    const { dialog } = await openLogin();
    await userEvent.type(within(dialog).getByLabelText('Email Address'), 'ann@example.com');
    await userEvent.type(within(dialog).getByLabelText('Password'), 'x');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Login' }));
    expect(await within(dialog).findByText(/couldn’t log you in/u)).toBeInTheDocument();
  });

  it('routes unverified users to the verification step and completes it', async () => {
    let verified = false;
    installBackend({
      handlers: [
        (url, init) => {
          if (url.pathname === '/api/auth/login') {
            return verified
              ? jsonResponse({ user: USER, accessToken: 'token', expiresIn: 900 })
              : jsonResponse({ error: { code: 'EMAIL_NOT_VERIFIED', message: 'verify' } }, 403);
          }
          if (url.pathname === '/api/auth/verify-email/request') {
            return jsonResponse({ message: 'sent' });
          }
          if (url.pathname === '/api/auth/verify-email/confirm' && init.method === 'POST') {
            verified = true;
            return jsonResponse({ message: 'ok' });
          }
          return undefined;
        },
      ],
    });
    const { dialog } = await openLogin();
    await userEvent.type(within(dialog).getByLabelText('Email Address'), 'ann@example.com');
    await userEvent.type(within(dialog).getByLabelText('Password'), 'password1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Login' }));
    expect(await screen.findByRole('dialog', { name: 'Verify your email' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    await userEvent.type(screen.getByLabelText('Verification code'), '12345678');
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(await screen.findByText('Email verified. Welcome, Ann!')).toBeInTheDocument();
  });

  it('switches between login and register tabs', async () => {
    installBackend();
    const { dialog } = await openLogin();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));
    expect(await screen.findByRole('dialog', { name: /Create Account/u })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByRole('dialog', { name: /Welcome Back/u })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    installBackend();
    const { router } = await openLogin();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('auth'));
  });
});

describe('register', () => {
  it('validates and creates an account, then asks for the code', async () => {
    installBackend({
      handlers: [
        (url) =>
          url.pathname === '/api/auth/register'
            ? jsonResponse({ message: 'created' }, 201)
            : undefined,
      ],
    });
    await renderApp('/?auth=register');
    const dialog = await screen.findByRole('dialog', { name: /Create Account/u });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Account' }));
    expect((await within(dialog).findAllByRole('alert')).length).toBeGreaterThan(0);

    await userEvent.type(within(dialog).getByLabelText('Username'), 'Ann');
    await userEvent.type(within(dialog).getByLabelText('Email Address'), 'ann@example.com');
    await userEvent.type(within(dialog).getByLabelText('Password'), 'password1');
    await userEvent.type(within(dialog).getByLabelText('Confirm Password'), 'different');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Account' }));
    expect(await within(dialog).findByText('Passwords do not match')).toBeInTheDocument();

    await userEvent.clear(within(dialog).getByLabelText('Confirm Password'));
    await userEvent.type(within(dialog).getByLabelText('Confirm Password'), 'password1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Account' }));
    expect(await screen.findByRole('dialog', { name: 'Verify your email' })).toBeInTheDocument();
  });

  it('shows the server error', async () => {
    installBackend({
      handlers: [
        (url) =>
          url.pathname === '/api/auth/register'
            ? jsonResponse({ error: { code: 'CONFLICT', message: 'Email taken' } }, 409)
            : undefined,
      ],
    });
    await renderApp('/?auth=register');
    const dialog = await screen.findByRole('dialog', { name: /Create Account/u });
    await userEvent.type(within(dialog).getByLabelText('Username'), 'Ann');
    await userEvent.type(within(dialog).getByLabelText('Email Address'), 'ann@example.com');
    await userEvent.type(within(dialog).getByLabelText('Password'), 'password1');
    await userEvent.type(within(dialog).getByLabelText('Confirm Password'), 'password1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create Account' }));
    expect(await within(dialog).findByText('Email taken')).toBeInTheDocument();
  });
});

describe('forgot password', () => {
  it('walks through email, code and new password', async () => {
    installBackend({
      handlers: [
        (url) => {
          if (url.pathname === '/api/auth/password-reset/request')
            return jsonResponse({ message: 'sent' });
          if (url.pathname === '/api/auth/password-reset/verify')
            return jsonResponse({ resetToken: 'rt' });
          if (url.pathname === '/api/auth/password-reset/confirm')
            return jsonResponse({ message: 'done' });
          return undefined;
        },
      ],
    });
    const { dialog } = await openLogin();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Forgot Password?' }));
    await userEvent.type(await screen.findByLabelText('Email Address'), 'ann@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await userEvent.type(await screen.findByLabelText('Verification code'), '12345678');
    await userEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await userEvent.type(await screen.findByLabelText('Password'), 'newpassword1');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'newpassword1');
    await userEvent.click(screen.getByRole('button', { name: /Reset|Update|Save|Change/u }));
    expect(await screen.findByText('Password updated. You can log in now.')).toBeInTheDocument();
  });

  it('can go back to the login form', async () => {
    installBackend();
    const { dialog } = await openLogin();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Forgot Password?' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Back to login' }));
    expect(await screen.findByRole('dialog', { name: /Welcome Back/u })).toBeInTheDocument();
  });
});

describe('session', () => {
  it('restores a session, shows the account menu and logs out', async () => {
    const { calls } = installBackend({ signedIn: true });
    await renderApp('/');
    const menu = await screen.findByRole('button', { name: /Ann/u });
    await userEvent.click(menu);
    await userEvent.click(await screen.findByRole('button', { name: 'Log Out' }));
    expect(await screen.findByText('You have been logged out.')).toBeInTheDocument();
    expect(calls.some((call) => call.path === '/auth/logout')).toBe(true);
  });

  it('prompts guests to log in on protected pages', async () => {
    installBackend();
    await renderApp('/account');
    expect(await screen.findByText('Log in to see this page.')).toBeInTheDocument();
    await renderApp('/favourites');
  });

  it('handles the Google return redirect', async () => {
    installBackend();
    await renderApp('/?provider=google&status=success');
    expect(await screen.findByText('You are signed in with Google.')).toBeInTheDocument();
  });

  it('handles a failed Google return', async () => {
    installBackend();
    await renderApp('/?provider=google&status=error');
    expect(await screen.findByText(/Google sign-in failed/u)).toBeInTheDocument();
  });

  it('expires the session when refresh fails mid-session', async () => {
    let expired = false;
    installBackend({
      signedIn: true,
      handlers: [
        (url) => {
          if (expired && url.pathname === '/api/auth/refresh') return jsonResponse({}, 401);
          if (url.pathname === '/api/catalog/leaderboard' && expired) return jsonResponse({}, 401);
          return undefined;
        },
      ],
    });
    const { queryClient } = await renderApp('/');
    await screen.findByRole('button', { name: /Ann/u });
    expired = true;
    await queryClient.invalidateQueries();
    expect(await screen.findByText(/session has expired/u)).toBeInTheDocument();
  });
});
