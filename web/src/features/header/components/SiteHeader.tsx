import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import logoSource from '@/assets/Logo.svg';
import { Button } from '@/shared/components/Button';

const NAV_ITEMS = [
    { label: 'Home', to: '/' },
    { label: 'Library', to: '/library' },
] as const;

export function SiteHeader() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isMenuOpen) {
            return;
        }

        const closeOnEscape = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                setIsMenuOpen(false);
                menuButtonRef.current?.focus();
            }
        };

        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [isMenuOpen]);

    const closeMenu = (): void => setIsMenuOpen(false);

    return (
        <header className="relative z-10 flex items-center justify-between gap-size-4 border-b border-on-primary bg-bg px-size-10 py-size-3 text-on-primary desktop:px-size-5 desktop:py-size-2">
            <Link
                aria-label="MiniGames home"
                className="inline-flex items-center gap-size-1 font-inter text-headline-medium font-bold text-on-primary"
                to="/"
            >
                <img
                    alt=""
                    className="size-icon-button-small"
                    height="32"
                    src={logoSource}
                    width="32"
                />
                <span>MiniGames</span>
            </Link>

            <nav
                aria-label="Primary navigation"
                className="hidden items-center gap-size-4 tablet-up:flex"
            >
                <ul className="flex list-none items-center gap-size-5">
                    {NAV_ITEMS.map((item) => (
                        <li key={item.to}>
                            <Link
                                activeProps={{ className: 'text-on-bg' }}
                                className="text-body-medium font-bold text-on-bg-low transition-colors hover:text-primary"
                                to={item.to}
                            >
                                {item.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            <Button
                ref={menuButtonRef}
                aria-controls="mobile-navigation"
                aria-expanded={isMenuOpen}
                className="tablet-up:hidden"
                onClick={() => setIsMenuOpen((open) => !open)}
            >
                {isMenuOpen ? 'Close menu' : 'Menu'}
            </Button>

            <div
                hidden={!isMenuOpen}
                className="fixed inset-0 z-50 flex min-h-screen flex-col gap-size-4 bg-bg-footer p-size-4 text-on-bg-footer tablet-up:hidden"
                id="mobile-navigation"
            >
                <div className="flex items-center justify-between">
                    <Link
                        aria-label="MiniGames home"
                        className="inline-flex items-center gap-size-1 font-inter text-headline-small font-bold text-white"
                        onClick={closeMenu}
                        to="/"
                    >
                        <img
                            alt=""
                            className="size-icon-button-small"
                            height="32"
                            src={logoSource}
                            width="32"
                        />
                        <span>MiniGames</span>
                    </Link>
                    <Button variant="inverse" onClick={closeMenu}>
                        Close
                    </Button>
                </div>

                <nav aria-label="Mobile navigation">
                    <ul className="flex list-none flex-col gap-size-3">
                        {NAV_ITEMS.map((item) => (
                            <li key={item.to}>
                                <Link
                                    activeProps={{ className: 'text-primary' }}
                                    className="text-body-medium font-bold text-on-bg-footer hover:text-primary"
                                    onClick={closeMenu}
                                    to={item.to}
                                >
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>
        </header>
    );
}
