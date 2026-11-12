import { useEffect, useId, useRef, useState } from 'react';
import type { SortKey } from '@/shared/api/games.api';
import { Icon } from '@/shared/components/Icon';

export const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string; short: string }> = [
    { value: 'rating-desc', label: 'Rating ↓', short: 'Rating ↓' },
    { value: 'rating-asc', label: 'Rating ↑', short: 'Rating ↑' },
    { value: 'name-asc', label: 'Name A–Z', short: 'Name A–Z' },
    { value: 'name-desc', label: 'Name Z–A', short: 'Name Z–A' },
];

type SortDropdownProps = {
    value: SortKey;
    onChange: (value: SortKey) => void;
};

export function SortDropdown({ value, onChange }: SortDropdownProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const menuId = useId();
    const current = SORT_OPTIONS.find((option) => option.value === value) ?? SORT_OPTIONS[0];

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
        <div className="relative w-full above-mobile:w-auto" ref={rootRef}>
            <button
                aria-controls={menuId}
                aria-expanded={open}
                aria-haspopup="true"
                className="inline-flex h-dropdown-trigger-height-compact w-full cursor-pointer items-center justify-between gap-size-1 rounded-extra-large border-button border-solid border-on-primary bg-white py-button-small-y pl-button-small-x pr-size-1 font-inter text-label-medium above-mobile:w-auto above-mobile:justify-start above-mobile:text-label-large font-bold leading-normal text-on-primary focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring above-tablet:h-dropdown-trigger-height-desktop"
                onClick={() => setOpen((previous) => !previous)}
                type="button"
            >
                Sort by: {current?.short}
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
                    {SORT_OPTIONS.map((option, index) => (
                        <li
                            className={
                                index > 0 ? 'border-t border-solid border-outline' : undefined
                            }
                            key={option.value}
                        >
                            <button
                                aria-pressed={option.value === value}
                                className="flex h-dropdown-item-height w-full cursor-pointer items-center justify-between gap-size-1 px-button-medium-x text-left font-inter text-label-large font-bold text-on-primary hover:bg-surface focus-visible:bg-surface focus-visible:outline-none"
                                onClick={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                                type="button"
                            >
                                {option.label}
                                {option.value === value ? (
                                    <Icon className="text-[20px]" name="check" />
                                ) : null}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
