import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';
import { getCategories, getGamesPage, type SortKey } from '@/shared/api/games.api';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Pagination } from '@/shared/components/Pagination';
import { FilterChips } from './FilterChips';
import { GameCard } from './GameCard';
import { GameDetailDialog } from './GameDetailDialog';
import { SortDropdown } from './SortDropdown';

export const LIBRARY_PAGE_SIZE = 6;

function CardSkeleton() {
    return (
        <div
            aria-hidden="true"
            className="flex animate-pulse flex-col overflow-hidden rounded-large border-[2.5px] border-solid border-outline bg-white min-[600px]:h-[152px] min-[600px]:flex-row desktop-up:h-[200px]"
        >
            <div className="h-40 bg-outline min-[600px]:h-auto min-[600px]:w-[270px] desktop-up:w-[320px]" />
            <div className="flex flex-1 flex-col justify-between gap-size-2 p-size-2">
                <div className="h-6 w-2/3 rounded-small bg-outline" />
                <div className="h-12 rounded-small bg-outline" />
                <div className="h-8 w-1/3 rounded-small bg-outline" />
            </div>
        </div>
    );
}

export function LibraryPage() {
    const search = useSearch({ from: '/library' });
    const navigate = useNavigate({ from: '/library' });

    const sort: SortKey = search.sort ?? 'rating-desc';
    const page = search.page ?? 1;

    const categoriesQuery = useQuery({
        queryKey: ['categories'],
        queryFn: ({ signal }) => getCategories(signal),
        staleTime: 10 * 60_000,
    });

    const defaultCategory =
        categoriesQuery.data?.find((category) => category.isDefault)?.slug ?? 'all';
    const category = search.category ?? defaultCategory;

    const gamesQuery = useQuery({
        queryKey: ['games', 'page', { page, category, sort, limit: LIBRARY_PAGE_SIZE }],
        queryFn: ({ signal }) =>
            getGamesPage({ page, category, sort, limit: LIBRARY_PAGE_SIZE, signal }),
        placeholderData: keepPreviousData,
    });

    const totalPages = gamesQuery.data?.meta.totalPages ?? 1;

    useEffect(() => {
        if (
            gamesQuery.isSuccess &&
            !gamesQuery.isPlaceholderData &&
            page > Math.max(1, totalPages)
        ) {
            void navigate({
                search: (previous) => ({
                    ...previous,
                    page: totalPages > 1 ? totalPages : undefined,
                }),
                replace: true,
            });
        }
    }, [gamesQuery.isSuccess, gamesQuery.isPlaceholderData, navigate, page, totalPages]);

    const update = (updates: {
        category?: string | undefined;
        sort?: SortKey | undefined;
        page?: number | undefined;
    }): void => {
        void navigate({
            search: (previous) => ({ ...previous, ...updates }),
        });
    };

    return (
        <div className="flex flex-col">
            <section className="flex flex-col gap-size-1 p-size-2 above-mobile:px-size-5 above-mobile:py-size-3 desktop-up:px-size-15 desktop-up:py-size-5">
                <h1 className="font-inter text-display-small font-bold leading-normal text-on-primary above-mobile:text-display-medium desktop-up:text-display-large">
                    Game Library
                </h1>
                <p className="text-body-small font-medium text-on-bg above-mobile:text-body-medium desktop-up:text-body-large">
                    Browse our collection of casual mini-games
                </p>
            </section>

            <section
                aria-label="Filters"
                className="flex flex-col gap-size-2 p-size-2 above-mobile:px-size-5 desktop-up:flex-row desktop-up:items-center desktop-up:justify-between desktop-up:px-size-15"
            >
                {categoriesQuery.isPending ? (
                    <div aria-hidden="true" className="flex gap-size-2">
                        {Array.from({ length: 6 }, (_, index) => (
                            <span
                                className="h-chip-height w-24 animate-pulse rounded-extra-large bg-outline"
                                key={index}
                            />
                        ))}
                    </div>
                ) : categoriesQuery.isError ? (
                    <ErrorState
                        message="We couldn't load the categories."
                        onRetry={() => void categoriesQuery.refetch()}
                    />
                ) : (
                    <FilterChips
                        active={category}
                        categories={categoriesQuery.data}
                        onSelect={(slug) =>
                            update({
                                category: slug === defaultCategory ? undefined : slug,
                                page: undefined,
                            })
                        }
                    />
                )}
                <div className="flex desktop-up:justify-end">
                    <SortDropdown
                        onChange={(next) =>
                            update({
                                sort: next === 'rating-desc' ? undefined : next,
                                page: undefined,
                            })
                        }
                        value={sort}
                    />
                </div>
            </section>

            <section
                aria-busy={gamesQuery.isFetching}
                aria-label="Games"
                className="px-size-2 above-mobile:px-size-5 desktop-up:px-size-15"
            >
                {gamesQuery.isPending ? (
                    <div
                        className="grid grid-cols-1 gap-size-3 desktop-up:grid-cols-2"
                        role="status"
                    >
                        <span className="sr-only">Loading games…</span>
                        {Array.from({ length: LIBRARY_PAGE_SIZE }, (_, index) => (
                            <CardSkeleton key={index} />
                        ))}
                    </div>
                ) : gamesQuery.isError ? (
                    <ErrorState
                        message="We couldn't load the games. Please try again."
                        onRetry={() => void gamesQuery.refetch()}
                    />
                ) : gamesQuery.data.games.length === 0 ? (
                    <EmptyState message="No games found in this category yet." />
                ) : (
                    <ul
                        className={`grid grid-cols-1 gap-size-3 transition-opacity desktop-up:grid-cols-2 ${gamesQuery.isPlaceholderData ? 'opacity-60' : ''}`}
                    >
                        {gamesQuery.data.games.map((game) => (
                            <li key={game.slug}>
                                <GameCard game={game} />
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <div className="px-size-2 py-size-3 above-mobile:p-size-5 desktop-up:px-size-15">
                <Pagination
                    onChange={(next) => update({ page: next === 1 ? undefined : next })}
                    page={page}
                    totalPages={totalPages}
                />
            </div>
            {search.game ? <GameDetailDialog key={search.game} slug={search.game} /> : null}
        </div>
    );
}
