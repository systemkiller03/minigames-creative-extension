import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installBackend, makeGame, PROFILE, renderApp, type Handler } from '@/test/app';
import { jsonResponse } from '@/test/utils';
import { setAccessToken } from '@/shared/api/client';

afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(null);
});

const sessions = {
    sessions: [
        {
            id: 's1',
            device: 'Chrome',
            userAgent: 'u',
            ipAddress: '1.1.1.1',
            createdAt: '2026-01-01T00:00:00Z',
            lastSeenAt: '2026-01-01T00:00:00Z',
            expiresAt: '2027-01-01T00:00:00Z',
            isCurrent: true,
        },
        {
            id: 's2',
            device: 'Firefox',
            userAgent: 'u',
            ipAddress: '2.2.2.2',
            createdAt: '2026-01-01T00:00:00Z',
            lastSeenAt: '2026-01-01T00:00:00Z',
            expiresAt: '2027-01-01T00:00:00Z',
            isCurrent: false,
        },
    ],
};
const sessionsHandler: Handler = (url, init) => {
    if (url.pathname === '/api/me/sessions' && init.method === 'GET') return jsonResponse(sessions);
    if (url.pathname.startsWith('/api/me/sessions') && init.method === 'DELETE')
        return new Response(null, { status: 204 });
    return undefined;
};

describe('account page', () => {
    it('updates the profile', async () => {
        const { calls } = installBackend({
            signedIn: true,
            handlers: [
                sessionsHandler,
                (url, init) =>
                    url.pathname === '/api/me' && init.method === 'PATCH'
                        ? jsonResponse({ user: { ...PROFILE, name: 'Anna' } })
                        : undefined,
            ],
        });
        await renderApp('/account');
        const input = await screen.findByLabelText('Username');
        await userEvent.clear(input);
        await userEvent.type(input, 'Anna');
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(await screen.findByText('Profile updated.')).toBeInTheDocument();
        expect(calls.some((call) => call.method === 'PATCH')).toBe(true);
    });

    it('shows a profile update error', async () => {
        installBackend({
            signedIn: true,
            handlers: [
                sessionsHandler,
                (url, init) =>
                    url.pathname === '/api/me' && init.method === 'PATCH'
                        ? jsonResponse({ error: { code: 'X', message: 'Name taken' } }, 409)
                        : undefined,
            ],
        });
        await renderApp('/account');
        const input = await screen.findByLabelText('Username');
        await userEvent.clear(input);
        await userEvent.type(input, 'Anna');
        await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(await screen.findByText('Name taken')).toBeInTheDocument();
    });

    it('changes the password', async () => {
        installBackend({
            signedIn: true,
            handlers: [
                sessionsHandler,
                (url) =>
                    url.pathname === '/api/me/password'
                        ? new Response(null, { status: 204 })
                        : undefined,
            ],
        });
        await renderApp('/account');
        await userEvent.type(await screen.findByLabelText('Current Password'), 'password1');
        await userEvent.type(screen.getByLabelText('New Password'), 'password2');
        await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
        expect(
            await screen.findByText('Password changed. Please log in again.'),
        ).toBeInTheDocument();
    });

    it('rejects an invalid new password and reports server errors', async () => {
        installBackend({
            signedIn: true,
            handlers: [
                sessionsHandler,
                (url) =>
                    url.pathname === '/api/me/password'
                        ? jsonResponse({ error: { code: 'X', message: 'Wrong password' } }, 400)
                        : undefined,
            ],
        });
        await renderApp('/account');
        await userEvent.type(await screen.findByLabelText('Current Password'), 'password1');
        await userEvent.type(screen.getByLabelText('New Password'), 'short');
        await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
        expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument();
        await userEvent.clear(screen.getByLabelText('New Password'));
        await userEvent.type(screen.getByLabelText('New Password'), 'password2');
        await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
        expect(await screen.findByText('Wrong password')).toBeInTheDocument();
    });

    it('hides the password form for accounts without a password', async () => {
        installBackend({
            signedIn: true,
            handlers: [
                sessionsHandler,
                (url, init) =>
                    url.pathname === '/api/me' && init.method === 'GET'
                        ? jsonResponse({
                              user: { ...PROFILE, hasPassword: false, providers: ['google'] },
                          })
                        : undefined,
            ],
        });
        await renderApp('/account');
        await screen.findByLabelText('Username');
        expect(screen.queryByLabelText('Current Password')).toBeNull();
    });

    it('lists devices and logs out one or all others', async () => {
        const { calls } = installBackend({ signedIn: true, handlers: [sessionsHandler] });
        await renderApp('/account');
        expect(await screen.findByText('Firefox')).toBeInTheDocument();
        expect(screen.getByText('This device')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
        expect(await screen.findByText('Device logged out.')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Log out other devices' }));
        expect(await screen.findByText('Logged out on all other devices.')).toBeInTheDocument();
        expect(
            calls.filter(
                (call) => call.method === 'DELETE' && call.path.startsWith('/me/sessions'),
            ),
        ).toHaveLength(2);
    });

    it('shows errors for sessions and revoke failures', async () => {
        installBackend({
            signedIn: true,
            handlers: [
                (url, init) => {
                    if (url.pathname === '/api/me/sessions' && init.method === 'GET') {
                        return jsonResponse(sessions);
                    }
                    if (url.pathname.startsWith('/api/me/sessions/')) return jsonResponse({}, 500);
                    return undefined;
                },
            ],
        });
        await renderApp('/account');
        await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
        expect(await screen.findByText('Could not log out that device.')).toBeInTheDocument();
    });

    it('shows an error when sessions fail to load', async () => {
        installBackend({
            signedIn: true,
            handlers: [
                (url) => (url.pathname === '/api/me/sessions' ? jsonResponse({}, 500) : undefined),
            ],
        });
        await renderApp('/account');
        expect(await screen.findByText("We couldn't load your devices.")).toBeInTheDocument();
    });

    it('shows an error when the profile fails to load', async () => {
        // Profile requested after session restore succeeds; fail the second /me call.
        let calls = 0;
        installBackend({
            signedIn: true,
            handlers: [
                (url) => {
                    if (url.pathname === '/api/me') {
                        calls += 1;
                        return calls > 1 ? jsonResponse({}, 500) : undefined;
                    }
                    return undefined;
                },
            ],
        });
        await renderApp('/account');
        expect(
            await screen.findByText("We couldn't load your account. Please try again."),
        ).toBeInTheDocument();
    });

    it('deletes the account after confirmation', async () => {
        const { calls } = installBackend({
            signedIn: true,
            handlers: [
                sessionsHandler,
                (url, init) =>
                    url.pathname === '/api/auth/account' && init.method === 'DELETE'
                        ? new Response(null, { status: 204 })
                        : undefined,
            ],
        });
        await renderApp('/account');
        await userEvent.click(await screen.findByRole('button', { name: 'Delete my account' }));
        const dialog = await screen.findByRole('dialog', { name: 'Delete account?' });
        await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
        expect(
            await within(dialog).findByText('Enter your password to confirm.'),
        ).toBeInTheDocument();
        await userEvent.type(within(dialog).getByLabelText('Password'), 'password1');
        await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
        expect(await screen.findByText('Your account has been deleted.')).toBeInTheDocument();
        expect(calls.some((call) => call.path === '/auth/account')).toBe(true);
    });

    it('can cancel account deletion', async () => {
        installBackend({ signedIn: true, handlers: [sessionsHandler] });
        await renderApp('/account');
        await userEvent.click(await screen.findByRole('button', { name: 'Delete my account' }));
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
});

describe('favourites', () => {
    it('lists favourites for a signed-in user', async () => {
        installBackend({ signedIn: true });
        await renderApp('/favourites');
        expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
        expect(await screen.findAllByRole('article')).toHaveLength(1);
    });

    it('shows the empty state and error state', async () => {
        installBackend({
            signedIn: true,
            handlers: [
                (url) =>
                    url.pathname === '/api/me/favourites' ? jsonResponse({ data: [] }) : undefined,
            ],
        });
        await renderApp('/favourites');
        expect(
            await screen.findByText("You haven't added any favourites yet."),
        ).toBeInTheDocument();
    });

    it('shows an error state', async () => {
        installBackend({
            signedIn: true,
            handlers: [
                (url) =>
                    url.pathname === '/api/me/favourites' ? jsonResponse({}, 500) : undefined,
            ],
        });
        await renderApp('/favourites');
        expect(
            await screen.findByText("We couldn't load your favourites. Please try again."),
        ).toBeInTheDocument();
    });

    it('asks guests to log in before favouriting', async () => {
        const { router } = await (async () => {
            installBackend();
            return renderApp('/library');
        })();
        const cards = await screen.findAllByRole('article');
        await userEvent.click(
            within(cards[0]!).getByRole('button', { name: /Add .* to favourites/u }),
        );
        expect(
            await screen.findByText('Log in to save games to your favourites.'),
        ).toBeInTheDocument();
        await waitFor(() => expect(router.state.location.search).toMatchObject({ auth: 'login' }));
    });

    it('adds a favourite optimistically for a signed-in user', async () => {
        const { calls } = installBackend({ signedIn: true });
        await renderApp('/library');
        const cards = await screen.findAllByRole('article');
        await userEvent.click(
            within(cards[0]!).getByRole('button', { name: /Add .* to favourites/u }),
        );
        expect(await screen.findByText('Added to your favourites.')).toBeInTheDocument();
        expect(calls.some((call) => call.method === 'PUT')).toBe(true);
        await userEvent.click(
            await within((await screen.findAllByRole('article'))[0]!).findByRole('button', {
                name: /Remove .* from favourites/u,
            }),
        );
        expect(await screen.findByText('Removed from your favourites.')).toBeInTheDocument();
    });

    it('rolls back and reports a failed favourite', async () => {
        installBackend({
            signedIn: true,
            handlers: [
                (url, init) =>
                    url.pathname.startsWith('/api/me/favourites/') && init.method === 'PUT'
                        ? jsonResponse({ error: { code: 'X', message: 'Nope' } }, 400)
                        : undefined,
            ],
        });
        await renderApp('/library');
        const cards = await screen.findAllByRole('article');
        await userEvent.click(
            within(cards[0]!).getByRole('button', { name: /Add .* to favourites/u }),
        );
        expect(await screen.findByText('Nope')).toBeInTheDocument();
        expect(makeGame('x').slug).toBe('x');
    });
});
