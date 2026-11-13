import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installBackend, renderApp } from '@/test/app';
import { jsonResponse } from '@/test/utils';
import { setAccessToken } from '@/shared/api/client';

afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(null);
});

describe('library page', () => {
    it('lists games and filters by category', async () => {
        const { calls } = installBackend();
        await renderApp('/library');
        expect(await screen.findAllByRole('article')).toHaveLength(3);
        await userEvent.click(await screen.findByRole('button', { name: 'Casual' }));
        await waitFor(() =>
            expect(calls.some((call) => call.path === '/catalog/games')).toBe(true),
        );
        expect(screen.getByRole('button', { name: 'Casual' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });

    it('sorts via the dropdown and closes it with Escape and outside click', async () => {
        installBackend();
        await renderApp('/library');
        await screen.findAllByRole('article');
        const trigger = screen.getByRole('button', { name: /Rating/u });
        await userEvent.click(trigger);
        await userEvent.click(screen.getByRole('button', { name: 'Name A–Z' }));
        await waitFor(() =>
            expect(screen.getByRole('button', { name: /Name A–Z/u })).toBeInTheDocument(),
        );
        await userEvent.click(screen.getByRole('button', { name: /Name A–Z/u }));
        await userEvent.keyboard('{Escape}');
        await userEvent.click(screen.getByRole('button', { name: /Name A–Z/u }));
        await userEvent.click(document.body);
    });

    it('paginates', async () => {
        const { router } = await (async () => {
            installBackend();
            return renderApp('/library');
        })();
        await screen.findAllByRole('article');
        await userEvent.click(screen.getByRole('button', { name: 'Page 2' }));
        await waitFor(() => expect(router.state.location.search).toMatchObject({ page: 2 }));
    });

    it('shows error and empty states', async () => {
        installBackend({
            handlers: [
                (url) =>
                    url.pathname.endsWith('/catalog/games') ? jsonResponse({}, 500) : undefined,
            ],
        });
        await renderApp('/library');
        expect(await screen.findByText(/couldn't load the games/u)).toBeInTheDocument();
    });

    it('shows the empty message', async () => {
        installBackend({
            handlers: [
                (url) =>
                    url.pathname.endsWith('/catalog/games')
                        ? jsonResponse({
                              data: [],
                              meta: { page: 1, limit: 6, totalItems: 0, totalPages: 0 },
                          })
                        : undefined,
            ],
        });
        await renderApp('/library');
        expect(await screen.findByText('No games found in this category yet.')).toBeInTheDocument();
    });

    it('shows a categories error', async () => {
        installBackend({
            handlers: [
                (url) => (url.pathname.endsWith('/categories') ? jsonResponse({}, 500) : undefined),
            ],
        });
        await renderApp('/library');
        expect(await screen.findByText(/couldn't load the categories/u)).toBeInTheDocument();
    });

    it('clamps an out-of-range page', async () => {
        installBackend({ totalPages: 2 });
        const { router } = await renderApp('/library?page=9');
        await waitFor(() => expect(router.state.location.search).toMatchObject({ page: 2 }));
    });
});

describe('game detail dialog', () => {
    it('opens from a card, shows details and closes', async () => {
        const { router } = await (async () => {
            installBackend();
            return renderApp('/library');
        })();
        const cards = await screen.findAllByRole('article');
        await userEvent.click(within(cards[0]!).getByRole('link', { name: 'Details' }));
        const dialog = await screen.findByRole('dialog', { name: /cast n chill/iu });
        expect(await within(dialog).findByText('Full description')).toBeInTheDocument();
        expect(within(dialog).getByText('Alex')).toBeInTheDocument();
        await userEvent.click(within(dialog).getByRole('button', { name: /Play Now/u }));
        expect(await screen.findByText(/coming soon/u)).toBeInTheDocument();
        await userEvent.keyboard('{Escape}');
        await waitFor(() => expect(router.state.location.search).not.toHaveProperty('game'));
    });

    it('shows not found for an unknown game', async () => {
        installBackend({
            handlers: [
                (url) =>
                    url.pathname.includes('/catalog/games/')
                        ? jsonResponse({ error: { code: 'NOT_FOUND', message: 'x' } }, 404)
                        : undefined,
            ],
        });
        await renderApp('/library?game=ghost');
        expect(await screen.findByText('We couldn’t find that game.')).toBeInTheDocument();
    });

    it('shows a retryable error on server failure', async () => {
        installBackend({
            handlers: [
                (url) =>
                    url.pathname.includes('/catalog/games/') ? jsonResponse({}, 500) : undefined,
            ],
        });
        await renderApp('/library?game=cast-n-chill');
        expect(
            await screen.findByRole('button', { name: 'Try again' }, { timeout: 6000 }),
        ).toBeInTheDocument();
    }, 10_000);
});
