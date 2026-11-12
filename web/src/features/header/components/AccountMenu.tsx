import { Link } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/shared/components/Icon';

type AccountMenuProps = {
    name: string;
    className?: string;
    onSignOut: () => void;
};

const ITEM_CLASS =
    'flex h-dropdown-item-height w-full cursor-pointer items-center gap-size-1 px-button-medium-x text-left font-inter text-label-large font-bold text-on-primary hover:bg-surface focus-visible:bg-surface focus-visible:outline-none';

export function AccountMenu({ name, className = '', onSignOut }: AccountMenuProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!open) {
            return;
        }
        const onPointerDown = (event: PointerEvent): void => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <div className={`relative items-center ${className}`} ref={rootRef}>
            <button
                aria-controls={menuId}
                aria-expanded={open}
                aria-haspopup="true"
                className="inline-flex cursor-pointer items-center gap-size-1 rounded-small font-inter text-title-xx-small font-medium text-on-primary focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring"
                onClick={() => setOpen((previous) => !previous)}
                type="button"
            >
                <span
                    aria-hidden="true"
                    className="inline-flex size-icon-button-small items-center justify-center rounded-full border-button border-solid border-on-primary bg-avatar-random-3"
                >
                    <Icon filled name="person" size={20} />
                </span>
                <span className="max-w-[160px] truncate">{name}</span>
                <Icon
                    className={`text-[24px] transition-transform duration-fast ${open ? 'rotate-180' : ''}`}
                    name="arrow_drop_down"
                />
            </button>
            {open ? (
                <ul
                    className="absolute right-0 z-20 mt-size-1 min-w-dropdown-menu-min-width list-none overflow-hidden rounded-medium border-button border-solid border-on-primary bg-white shadow-[4px_4px_0_var(--color-on-primary)]"
                    id={menuId}
                >
                    <li>
                        <Link
                            className={ITEM_CLASS}
                            onClick={() => setOpen(false)}
                            to="/favourites"
                        >
                            <Icon className="text-[20px] text-like" filled name="favorite" />
                            Favourites
                        </Link>
                    </li>
                    <li className="border-t border-solid border-outline">
                        <Link className={ITEM_CLASS} onClick={() => setOpen(false)} to="/account">
                            <Icon className="text-[20px]" name="person" />
                            Account
                        </Link>
                    </li>
                    <li className="border-t border-solid border-outline">
                        <button
                            className={ITEM_CLASS}
                            onClick={() => {
                                setOpen(false);
                                onSignOut();
                            }}
                            type="button"
                        >
                            <Icon className="text-[20px]" name="logout" />
                            Log Out
                        </button>
                    </li>
                </ul>
            ) : null}
        </div>
    );
}
