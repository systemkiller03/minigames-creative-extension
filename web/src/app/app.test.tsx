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

describe('home page', () => {
  it('renders the hero, featured games, leaderboard and footer', async () => {
    installBackend();
    await renderApp('/');
    expect(await screen.findByRole('heading', { name: /Take a Short Break/u })).toBeInTheDocument();
    expect(await screen.findByText('Alex_Pro99')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(await screen.findAllByLabelText(/details in the library/u)).not.toHaveLength(0);
    expect(screen.getByText(/Are You a Game Developer/u)).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('shows error and empty states for the leaderboard', async () => {
    installBackend({
      handlers: [
        (url) => (url.pathname.endsWith('/leaderboard') ? jsonResponse({}, 500) : undefined),
      ],
    });
    await renderApp('/');
    expect(await screen.findByText('The leaderboard could not be loaded.')).toBeInTheDocument();
  });

  it('shows the empty leaderboard message', async () => {
    installBackend({
      handlers: [
        (url) => (url.pathname.endsWith('/leaderboard') ? jsonResponse({ data: [] }) : undefined),
      ],
    });
    await renderApp('/');
    expect(await screen.findByText(/leaderboard is empty/u)).toBeInTheDocument();
  });

  it('shows an error when featured games fail and an empty message when none', async () => {
    installBackend({
      handlers: [(url) => (url.searchParams.get('featured') ? jsonResponse({}, 500) : undefined)],
    });
    await renderApp('/');
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
  });

  it('moves the carousel with the arrow buttons', async () => {
    installBackend();
    await renderApp('/');
    await screen.findAllByLabelText(/details in the library/u);
    const next = screen.getAllByRole('button', { name: /next/iu })[0];
    const previous = screen.getAllByRole('button', { name: /prev/iu })[0];
    await userEvent.click(next!);
    await userEvent.click(previous!);
  });
});

describe('routing', () => {
  it('renders the not found page', async () => {
    installBackend();
    await renderApp('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('redirects the legacy route search param', async () => {
    installBackend();
    const { router } = await renderApp('/?route=library');
    await waitFor(() => expect(router.state.location.pathname).toBe('/library'));
  });

  it('shows not found for unknown legacy routes', async () => {
    installBackend();
    await renderApp('/?route=wat');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('redirects out-of-scope nav items to the home page', async () => {
    installBackend();
    const { router } = await renderApp('/library');
    const link = within(
      await screen.findByRole('navigation', { name: 'Primary navigation' }),
    ).getByText('Tournaments');
    await userEvent.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});
