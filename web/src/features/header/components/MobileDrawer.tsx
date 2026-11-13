import { Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import logoSource from '@/assets/Logo.svg';
import { getButtonClassName } from '@/shared/components/Button';
import { Icon } from '@/shared/components/Icon';
import { NavAnchor } from '@/shared/components/NavAnchor';
import { NAV_ITEMS } from '@/shared/components/NavLinks';

type MobileDrawerProps = {
    open: boolean;
    isAuthenticated: boolean;
    onClose: () => void;
    onSignOut: () => void;
};

export function MobileDrawer({ open, isAuthenticated, onClose, onSignOut }: MobileDrawerProps) {
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        closeRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, onClose]);

    return (
        <div
            aria-hidden={!open}
            className={`fixed inset-0 z-50 above-tablet:hidden ${open ? '' : 'pointer-events-none'}`}
            inert={!open}
        >
            <div
                className={`absolute inset-0 bg-on-primary/50 transition-opacity duration-fast ease-fast ${open ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <aside
                aria-label="Menu"
                aria-modal="true"
                className={`absolute inset-y-0 right-0 flex w-[320px] max-w-full flex-col gap-size-4 border-l-2 border-on-primary bg-bg-footer p-size-3 transition-transform duration-fast ease-fast ${open ? 'translate-x-0' : 'translate-x-full'}`}
                id="mobile-navigation"
                role="dialog"
            >
                <div className="flex items-center justify-between">
                    <Link
                        aria-label="MiniGames home"
                        className="inline-flex items-center gap-size-1 font-inter text-headline-small font-bold text-white"
                        onClick={onClose}
                        to="/"
                    >
                        <img alt="" height="32" src={logoSource} width="32" />
                        <span>MiniGames</span>
                    </Link>
                    <button
                        aria-label="Close menu"
                        className="inline-flex size-icon-button-small cursor-pointer items-center justify-center rounded-small bg-bg-footer-low text-white focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-primary"
                        onClick={onClose}
                        ref={closeRef}
                        type="button"
                    >
                        <Icon className="text-[20px]" name="close" />
                    </button>
                </div>

                <nav aria-label="Mobile navigation">
                    <ul className="flex list-none flex-col gap-size-3">
                        {NAV_ITEMS.map((item) => (
                            <li key={item.label}>
                                <NavAnchor
                                    activeClassName="font-bold text-primary"
                                    className="block text-title-xxx-small leading-normal transition-colors hover:text-white"
                                    inactiveClassName="font-medium text-on-bg-footer"
                                    item={item}
                                    onNavigate={onClose}
                                />
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="mt-auto flex flex-col gap-size-2">
                    {isAuthenticated ? (
                        <>
                            <Link
                                className={getButtonClassName(
                                    'outline',
                                    'lg',
                                    'border-white text-white hover:bg-bg-footer-low',
                                )}
                                onClick={onClose}
                                to="/favourites"
                            >
                                Favourites
                            </Link>
                            <Link
                                className={getButtonClassName(
                                    'outline',
                                    'lg',
                                    'border-white text-white hover:bg-bg-footer-low',
                                )}
                                onClick={onClose}
                                to="/account"
                            >
                                Account
                            </Link>
                            <button
                                className={getButtonClassName(
                                    'outline',
                                    'lg',
                                    'border-white text-white hover:bg-bg-footer-low',
                                )}
                                onClick={() => {
                                    onClose();
                                    onSignOut();
                                }}
                                type="button"
                            >
                                Log Out
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                className={getButtonClassName(
                                    'outline',
                                    'lg',
                                    'border-white text-white hover:bg-bg-footer-low',
                                )}
                                onClick={onClose}
                                search={(previous) => ({ ...previous, auth: 'login' })}
                                to="."
                            >
                                Log In
                            </Link>
                            <Link
                                className={getButtonClassName('primary', 'lg')}
                                onClick={onClose}
                                search={(previous) => ({ ...previous, auth: 'register' })}
                                to="."
                            >
                                Sign Up
                            </Link>
                        </>
                    )}
                </div>
            </aside>
        </div>
    );
}
