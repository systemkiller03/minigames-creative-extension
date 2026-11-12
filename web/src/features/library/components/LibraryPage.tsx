import { useEffect } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import type { Game } from '@/shared/api/games.api';
import { getGames } from '@/shared/api/games.api';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'rating-desc', label: 'Highest rated' },
  { value: 'rating-asc', label: 'Lowest rated' },
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'name-desc', label: 'Name: Z to A' },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]['value'];
type SearchUpdates = {
  category: string | undefined;
  page: number | undefined;
  sort: SortOption | undefined;
};

function sortGames(games: Game[], sort: SortOption): Game[] {
  return [...games].sort((a, b) => {
    switch (sort) {
      case 'rating-asc':
        return a.rating - b.rating || a.name.localeCompare(b.name);
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'rating-desc':
        return b.rating - a.rating || a.name.localeCompare(b.name);
    }
  });
}

function GameCard({ game }: { game: Game }) {
  return (
    <Link
      aria-label={`View ${game.name} details`}
      className="group flex h-full flex-col overflow-hidden rounded-large border-button-thin border-outline-variant bg-white shadow-level-1 transition-transform duration-fast ease-fast hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring"
      search={(previous) => ({ ...previous, game: game.slug })}
      to="/library"
    >
      <div className="aspect-[3/2] overflow-hidden bg-surface">
        <img
          alt=""
          className="h-full w-full object-cover transition-transform duration-fast ease-fast group-hover:scale-105"
          height="384"
          loading="lazy"
          src={game.cardImage}
          width="576"
        />
      </div>
      <div className="flex flex-1 flex-col gap-size-1 p-size-2">
        <div className="flex items-start justify-between gap-size-1">
          <h2 className="text-headline-small font-bold text-on-primary">{game.name}</h2>
          <span className="shrink-0 rounded-small bg-surface px-size-1 py-size-05 text-label-medium font-bold text-on-primary">
            {game.price}
          </span>
        </div>
        <p className="line-clamp-2 text-body-small">{game.shortDescription}</p>
        <div className="mt-auto flex items-center justify-between gap-size-1 pt-size-1 text-body-small">
          <span className="capitalize">{game.category}</span>
          <span className="font-bold text-on-primary">
            <span aria-hidden="true" className="text-primary-high">
              ★
            </span>{' '}
            <span className="sr-only">Rated </span>
            {game.rating.toFixed(1)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function LibraryPage() {
  const search = useSearch({ from: '/library' });
  const navigate = useNavigate({ from: '/library' });
  const {
    data: games,
    isError,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ['library', 'games'],
    queryFn: ({ signal }) => getGames({ signal }),
  });

  const sort = search.sort ?? 'rating-desc';
  const categories = [...new Set((games ?? []).map((game) => game.category))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const filteredGames = (games ?? []).filter(
    (game) => !search.category || game.category === search.category,
  );
  const sortedGames = sortGames(filteredGames, sort);
  const pageCount = Math.max(1, Math.ceil(sortedGames.length / PAGE_SIZE));
  const currentPage = Math.min(search.page ?? 1, pageCount);
  const visibleGames = sortedGames.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (!isPending && !isError && search.page && search.page > pageCount) {
      void navigate({
        search: (previous) => ({
          ...previous,
          page: pageCount === 1 ? undefined : pageCount,
        }),
        replace: true,
      });
    }
  }, [isError, isPending, navigate, pageCount, search.page]);

  const updateSearch = (updates: SearchUpdates) =>
    navigate({
      search: (previous) => ({
        ...previous,
        category: updates.category,
        page: updates.page,
        sort: updates.sort,
      }),
    });

  if (isPending) {
    return (
      <section
        aria-labelledby="library-title"
        className="mx-auto w-full max-w-content px-size-2 py-size-5 tablet-up:px-size-4 desktop-up:px-size-8 desktop-up:py-size-8"
      >
        <h1
          className="text-headline-large font-bold text-on-primary tablet-up:text-display-small"
          id="library-title"
        >
          Game Library
        </h1>
        <LoadingState label="Loading games..." />
      </section>
    );
  }

  if (isError) {
    return (
      <section
        aria-labelledby="library-title"
        className="mx-auto w-full max-w-content px-size-2 py-size-5 tablet-up:px-size-4 desktop-up:px-size-8 desktop-up:py-size-8"
      >
        <h1
          className="text-headline-large font-bold text-on-primary tablet-up:text-display-small"
          id="library-title"
        >
          Game Library
        </h1>
        <ErrorState message="Games could not be loaded." onRetry={() => void refetch()} />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="library-title"
      className="mx-auto w-full max-w-content px-size-2 py-size-5 tablet-up:px-size-4 desktop-up:px-size-8 desktop-up:py-size-8"
    >
      <header className="mb-size-3 flex flex-col gap-size-1">
        <h1
          className="text-headline-large font-bold text-on-primary tablet-up:text-display-small"
          id="library-title"
        >
          Game Library
        </h1>
        <p className="max-w-prose text-body-medium">
          Browse the collection and find your next favorite game.
        </p>
      </header>

      <div className="mb-size-3 flex flex-col gap-size-2 rounded-large border-button-thin border-outline-variant bg-white p-size-2 tablet-up:flex-row tablet-up:items-end tablet-up:justify-between">
        <label className="flex w-full flex-col gap-size-05 text-label-large font-bold text-on-primary tablet-up:max-w-dropdown-trigger-width-tablet">
          Category
          <select
            className="h-dropdown-trigger-height-compact w-full rounded-small border-button-thin border-outline-variant bg-white px-size-1 text-body-medium font-regular focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring tablet-up:h-dropdown-trigger-height-desktop"
            onChange={(event) =>
              void updateSearch({
                category: event.target.value || undefined,
                page: undefined,
                sort,
              })
            }
            value={search.category ?? ''}
          >
            <option value="">All categories</option>
            {search.category && !categories.includes(search.category) ? (
              <option value={search.category}>{search.category}</option>
            ) : null}
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="flex w-full flex-col gap-size-05 text-label-large font-bold text-on-primary tablet-up:max-w-dropdown-trigger-width-tablet">
          Sort by
          <select
            className="h-dropdown-trigger-height-compact w-full rounded-small border-button-thin border-outline-variant bg-white px-size-1 text-body-medium font-regular focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring tablet-up:h-dropdown-trigger-height-desktop"
            onChange={(event) => {
              const nextSort =
                SORT_OPTIONS.find((option) => option.value === event.target.value)?.value ??
                'rating-desc';
              void updateSearch({ category: search.category, page: undefined, sort: nextSort });
            }}
            value={sort}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        aria-live="polite"
        className="mb-size-2 text-body-small"
        data-testid="library-results-count"
      >
        {sortedGames.length} {sortedGames.length === 1 ? 'game' : 'games'}
        {search.category ? ` in ${search.category}` : ''}
      </div>

      {visibleGames.length ? (
        <div className="grid grid-cols-1 gap-size-2 mobile:grid-cols-2 tablet-up:grid-cols-3 desktop-up:grid-cols-4">
          {visibleGames.map((game) => (
            <GameCard game={game} key={game.slug} />
          ))}
        </div>
      ) : (
        <div className="rounded-large border-button-thin border-outline-variant bg-white px-size-2">
          <EmptyState message="No games match this category. Try choosing another category." />
        </div>
      )}

      {sortedGames.length > PAGE_SIZE ? (
        <nav
          aria-label="Game library pages"
          className="mt-size-4 flex flex-wrap items-center justify-center gap-size-2"
        >
          <Button
            aria-label="Previous page"
            disabled={currentPage === 1}
            onClick={() =>
              void updateSearch({
                category: search.category,
                page: currentPage - 1,
                sort,
              })
            }
            variant="outline"
          >
            Previous
          </Button>
          <span aria-current="page" className="min-w-pagination text-center font-bold">
            Page {currentPage} of {pageCount}
          </span>
          <Button
            aria-label="Next page"
            disabled={currentPage === pageCount}
            onClick={() =>
              void updateSearch({
                category: search.category,
                page: currentPage + 1,
                sort,
              })
            }
            variant="outline"
          >
            Next
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
