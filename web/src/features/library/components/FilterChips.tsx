import type { Category } from '@/shared/api/games.api';

type FilterChipsProps = {
    categories: Category[];
    active: string;
    onSelect: (slug: string) => void;
};

export function FilterChips({ categories, active, onSelect }: FilterChipsProps) {
    return (
        <ul
            aria-label="Filter by category"
            className="-mx-size-2 flex list-none gap-size-2 overflow-x-auto px-size-2 py-size-05 above-mobile:-mx-size-5 above-mobile:px-size-5 desktop-up:mx-0 desktop-up:flex-wrap desktop-up:overflow-visible desktop-up:px-0"
        >
            {categories.map((category) => {
                const isActive = category.slug === active;
                return (
                    <li className="shrink-0" key={category.slug}>
                        <button
                            aria-pressed={isActive}
                            className={`inline-flex min-h-chip-height-mobile cursor-pointer items-center justify-center rounded-extra-large border-button border-solid border-on-primary px-button-small-x py-button-small-y font-inter text-label-large font-bold leading-normal text-on-primary transition-colors duration-fast ease-fast focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring ${
                                isActive ? 'bg-primary' : 'bg-white hover:bg-surface'
                            }`}
                            onClick={() => onSelect(category.slug)}
                            type="button"
                        >
                            {category.label}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
