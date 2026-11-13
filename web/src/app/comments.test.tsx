import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from '@/shared/api/client';
import { installBackend, renderApp } from '@/test/app';
import { jsonResponse } from '@/test/utils';

afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(null);
});

async function openDetail() {
    const result = await renderApp('/library?game=cast-n-chill');
    const section = await screen.findByRole('region', { name: /Comments/u });
    return { ...result, section };
}

describe('game comments', () => {
    it('lists comments and asks guests to log in', async () => {
        installBackend();
        const { router, section } = await openDetail();
        expect(await within(section).findByText('Great game!')).toBeInTheDocument();
        expect(within(section).getByText('Bob')).toBeInTheDocument();
        expect(section).toHaveTextContent('Comments (1)');
        expect(within(section).queryByRole('textbox')).toBeNull();

        await userEvent.click(within(section).getByRole('link', { name: 'Log In' }));
        await waitFor(() => expect(router.state.location.search).toMatchObject({ auth: 'login' }));
    });

    it('sends guests to log in when they like a comment', async () => {
        installBackend();
        const { router, section } = await openDetail();
        await userEvent.click(await within(section).findByRole('button', { name: 'Like comment' }));
        expect(await screen.findByText('Log in to like comments.')).toBeInTheDocument();
        await waitFor(() => expect(router.state.location.search).toMatchObject({ auth: 'login' }));
    });

    it('likes a comment when signed in', async () => {
        const { calls } = installBackend({ signedIn: true });
        const { section } = await openDetail();
        await userEvent.click(await within(section).findByRole('button', { name: 'Like comment' }));
        expect(
            await within(section).findByRole('button', { name: 'Unlike comment' }),
        ).toHaveTextContent('4');
        expect(calls.some((call) => call.path === '/catalog/comments/c1/like')).toBe(true);
    });

    it('reports a failed like', async () => {
        installBackend({
            signedIn: true,
            handlers: [
                (url) =>
                    url.pathname.endsWith('/like')
                        ? jsonResponse({ error: { code: 'X', message: 'Slow down' } }, 429)
                        : undefined,
            ],
        });
        const { section } = await openDetail();
        await userEvent.click(await within(section).findByRole('button', { name: 'Like comment' }));
        expect(await screen.findByText('Slow down')).toBeInTheDocument();
    });

    it('validates and posts a comment', async () => {
        const { calls } = installBackend({ signedIn: true });
        const { section } = await openDetail();
        await userEvent.click(await within(section).findByRole('button', { name: 'Post comment' }));
        expect(await within(section).findByText('Write something first.')).toBeInTheDocument();

        await userEvent.type(within(section).getByRole('textbox'), 'Loved it');
        await userEvent.click(within(section).getByRole('button', { name: 'Post comment' }));
        expect(await screen.findByText('Comment posted.')).toBeInTheDocument();
        expect(await within(section).findByText('Loved it')).toBeInTheDocument();
        expect(section).toHaveTextContent('Comments (2)');
        expect(within(section).getByRole('textbox')).toHaveValue('');
        expect(
            calls.find((call) => call.method === 'POST' && call.path.endsWith('/comments'))?.body,
        ).toEqual({ text: 'Loved it' });
    });

    it('reports a failed post and keeps the text', async () => {
        installBackend({
            signedIn: true,
            handlers: [
                (url, init) =>
                    url.pathname.endsWith('/comments') && init.method === 'POST'
                        ? jsonResponse({}, 500)
                        : undefined,
            ],
        });
        const { section } = await openDetail();
        await userEvent.type(await within(section).findByRole('textbox'), 'Hello');
        await userEvent.click(within(section).getByRole('button', { name: 'Post comment' }));
        expect(
            await screen.findByText('Could not post your comment. Please try again.'),
        ).toBeInTheDocument();
        expect(within(section).getByRole('textbox')).toHaveValue('Hello');
    });

    it('shows the empty state', async () => {
        installBackend({
            handlers: [
                (url) =>
                    url.pathname.endsWith('/comments')
                        ? jsonResponse({ data: [], meta: { totalComments: 0 } })
                        : undefined,
            ],
        });
        const { section } = await openDetail();
        expect(
            await within(section).findByText('No comments yet. Be the first!'),
        ).toBeInTheDocument();
    });

    it('shows an error with retry', async () => {
        let fail = true;
        installBackend({
            handlers: [
                (url) =>
                    fail && url.pathname.endsWith('/comments') ? jsonResponse({}, 500) : undefined,
            ],
        });
        const { section } = await openDetail();
        expect(await within(section).findByText(/couldn’t load the comments/u)).toBeInTheDocument();
        fail = false;
        await userEvent.click(within(section).getByRole('button', { name: /Try again|Retry/u }));
        expect(await within(section).findByText('Great game!')).toBeInTheDocument();
    });
});
