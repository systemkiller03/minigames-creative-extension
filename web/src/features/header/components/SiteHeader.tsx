import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import hamburgerSource from '@/assets/icons/hamburger.svg';
import logoSource from '@/assets/Logo.svg';
import { useAuth } from '@/features/auth/AuthProvider';
import { getButtonClassName } from '@/shared/components/Button';
import { NavAnchor } from '@/shared/components/NavAnchor';
import { NAV_ITEMS } from '@/shared/components/NavLinks';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';
import { AccountMenu } from './AccountMenu';
import { MobileDrawer } from './MobileDrawer';

const NAV_LINK_BASE = 'text-title-xx-small leading-normal transition-colors hover:text-on-primary';

export function SiteHeader() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { status, user, signOut } = useAuth();
  const snackbar = useSnackbar();
  const navigate = useNavigate();

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut();
      snackbar.success('You have been logged out.');
      void navigate({ to: '/' });
    } catch {
      snackbar.error('Could not log out. Please try again.');
    }
  };

  const isAuthenticated = status === 'authenticated' && user !== null;

  return (
    <header className="relative z-10 flex items-center justify-between border-b-2 border-on-primary bg-bg p-size-2 text-on-primary above-mobile:px-size-5 desktop-up:px-size-10 desktop-up:py-size-3">
      <Link
        aria-label="MiniGames home"
        className="inline-flex items-center gap-size-1 font-inter text-headline-small font-bold text-on-primary desktop-up:text-headline-medium"
        to="/"
      >
        <img alt="" className="size-icon-button-small" height="32" src={logoSource} width="32" />
        <span>MiniGames</span>
      </Link>

      <div className="flex items-center gap-size-4">
        <nav aria-label="Primary navigation" className="hidden above-tablet:block">
          <ul className="flex list-none items-center gap-size-5">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <NavAnchor
                  activeClassName="font-bold text-on-primary"
                  className={NAV_LINK_BASE}
                  inactiveClassName="font-medium text-on-bg"
                  item={item}
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-size-2">
          {status === 'loading' ? (
            <span
              aria-hidden="true"
              className="hidden h-button-height-medium w-[150px] animate-pulse rounded-small bg-outline above-tablet:block"
            />
          ) : isAuthenticated ? (
            <AccountMenu
              className="hidden above-tablet:flex"
              name={user.name}
              onSignOut={() => void handleSignOut()}
            />
          ) : (
            <>
              <Link
                className={getButtonClassName('outline', 'md', 'hidden above-tablet:inline-flex')}
                search={(previous) => ({ ...previous, auth: 'login' })}
                to="."
              >
                Log In
              </Link>
              <Link
                className={getButtonClassName('primary', 'md', 'hidden above-tablet:inline-flex')}
                search={(previous) => ({ ...previous, auth: 'register' })}
                to="."
              >
                Sign Up
              </Link>
              <Link
                className={getButtonClassName(
                  'primary',
                  'sm',
                  'hidden above-mobile:inline-flex above-tablet:hidden',
                )}
                search={(previous) => ({ ...previous, auth: 'register' })}
                to="."
              >
                Sign Up
              </Link>
            </>
          )}

          <button
            aria-controls="mobile-navigation"
            aria-expanded={isDrawerOpen}
            aria-label="Open menu"
            className="size-icon-button-small shrink-0 cursor-pointer rounded-small focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring above-tablet:hidden"
            onClick={() => setIsDrawerOpen(true)}
            type="button"
          >
            <img alt="" height="32" src={hamburgerSource} width="32" />
          </button>
        </div>
      </div>

      <MobileDrawer
        isAuthenticated={isAuthenticated}
        onClose={() => setIsDrawerOpen(false)}
        onSignOut={() => void handleSignOut()}
        open={isDrawerOpen}
      />
    </header>
  );
}
