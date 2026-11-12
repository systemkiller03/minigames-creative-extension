import { Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { Button, getButtonClassName } from '@/shared/components/Button';
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
                className={`absolute inset-y-0 right-0 flex w-[320px] max-w-full flex-col gap-size-4 border-l-2 border-on-primary bg-bg p-size-3 transition-transform duration-fast ease-fast ${open ? 'translate-x-0' : 'translate-x-full'}`}
                id="mobile-navigation"
                role="dialog"
            >
                <div className="flex justify-end">
                    <button
                        aria-label="Close menu"
                        className="inline-flex size-icon-button-small cursor-pointer items-center justify-center rounded-small text-on-primary focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring"
                        onClick={onClose}
                        ref={closeRef}
                        type="button"
                    >
                        <Icon name="close" />
                    </button>
                </div>

                <nav aria-label="Mobile navigation">
                    <ul className="flex list-none flex-col gap-size-1">
                        {NAV_ITEMS.map((item) => (
                            <li key={item.label}>
                                <NavAnchor
                                    activeClassName="bg-surface font-bold text-on-primary"
                                    className="block rounded-small px-size-2 py-size-1 text-title-xxx-small leading-normal transition-colors hover:bg-surface"
                                    inactiveClassName="font-medium text-on-bg"
                                    item={item}
                                    onNavigate={onClose}
                                />
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="mt-auto flex flex-col gap-size-2">
                    {isAuthenticated ? (
                        <Button
                            onClick={() => {
                                onClose();
                                onSignOut();
                            }}
                            size="lg"
                            variant="outline"
                        >
                            Log Out
                        </Button>
                    ) : (
                        <>
                            <Link
                                className={getButtonClassName('outline', 'lg')}
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
