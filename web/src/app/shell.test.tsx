import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteError } from '@/app/components/RouteError';
import { RoutePending } from '@/app/components/RoutePending';
import { setAccessToken } from '@/shared/api/client';
import { installBackend, renderApp } from '@/test/app';

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
  document.body.style.overflow = '';
});

describe('mobile drawer', () => {
  it('opens, navigates, and closes with Escape and the close button', async () => {
    installBackend();
    await renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Menu', hidden: true });
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.body.style.overflow).toBe(''));
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Close menu', hidden: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(within(drawer).getByText('Library', { selector: 'a' }));
  });

  it('offers account links and log out for signed-in users', async () => {
    installBackend({ signedIn: true });
    await renderApp('/');
    await screen.findByRole('button', { name: /Ann/u });
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Menu', hidden: true });
    expect(within(drawer).getByText('Favourites', { selector: 'a' })).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Log Out', hidden: true }));
    expect(await screen.findByText('You have been logged out.')).toBeInTheDocument();
  });

  it('opens the sign up dialog from the drawer', async () => {
    installBackend();
    const { router } = await renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Menu', hidden: true });
    await userEvent.click(within(drawer).getByText('Sign Up', { selector: 'a' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ auth: 'register' }));
  });
});

describe('route fallbacks', () => {
  it('renders pending and error components', () => {
    const { container } = render(<RoutePending />);
    expect(container).not.toBeEmptyDOMElement();
    render(<RouteError error={new Error('boom')} reset={() => undefined} />);
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });
});
