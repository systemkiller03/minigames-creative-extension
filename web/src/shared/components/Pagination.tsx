import { Icon } from './Icon';

type PaginationProps = {
    page: number;
    totalPages: number;
    onChange: (page: number) => void;
};

const BASE =
    'inline-flex size-pagination cursor-pointer items-center justify-center rounded-full border-button border-solid font-inter text-label-large font-bold leading-normal transition-colors duration-fast ease-fast focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring';

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
    if (totalPages <= 1) {
        return null;
    }

    const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

    return (
        <nav aria-label="Pagination" className="flex justify-center">
            <ul className="flex list-none flex-wrap items-center justify-center gap-size-1 desktop-up:gap-pagination-gap">
                <li>
                    <button
                        aria-label="Previous page"
                        className={`${BASE} border-on-primary bg-white text-on-primary hover:bg-surface disabled:cursor-not-allowed disabled:border-outline-variant disabled:bg-bg disabled:opacity-50 disabled:hover:bg-bg`}
                        disabled={page <= 1}
                        onClick={() => onChange(page - 1)}
                        type="button"
                    >
                        <Icon className="text-[20px]" name="chevron_left" />
                    </button>
                </li>
                {pages.map((item) => (
                    <li key={item}>
                        <button
                            aria-current={item === page ? 'page' : undefined}
                            aria-label={`Page ${item}`}
                            className={`${BASE} ${
                                item === page
                                    ? 'border-on-primary bg-bg-footer-low text-white'
                                    : 'border-on-primary bg-white text-on-primary hover:bg-surface'
                            }`}
                            onClick={() => onChange(item)}
                            type="button"
                        >
                            {item}
                        </button>
                    </li>
                ))}
                <li>
                    <button
                        aria-label="Next page"
                        className={`${BASE} border-on-primary bg-white text-on-primary hover:bg-surface disabled:cursor-not-allowed disabled:border-outline-variant disabled:bg-bg disabled:opacity-50 disabled:hover:bg-bg`}
                        disabled={page >= totalPages}
                        onClick={() => onChange(page + 1)}
                        type="button"
                    >
                        <Icon className="text-[20px]" name="chevron_right" />
                    </button>
                </li>
            </ul>
        </nav>
    );
}
