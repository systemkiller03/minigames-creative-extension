import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { GameCard } from '@/features/library/components/GameCard';
import { getFavouriteGames } from '@/shared/api/games.api';
import { getButtonClassName } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';

function FavouritesList() {
  const query = useQuery({
    queryKey: ['favourites'],
    queryFn: ({ signal }) => getFavouriteGames(signal),
  });

  if (query.isPending) {
    return <LoadingState label="Loading your favourites..." />;
  }
  if (query.isError) {
    return (
      <ErrorState
        message="We couldn't load your favourites. Please try again."
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-size-2">
        <EmptyState message="You haven't added any favourites yet." />
        <Link className={getButtonClassName('primary', 'md')} to="/library">
          Browse the library
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-size-3 desktop-up:grid-cols-2">
      {query.data.map((game) => (
        <li key={game.slug}>
          <GameCard game={{ ...game, isFavorited: true }} />
        </li>
      ))}
    </ul>
  );
}

export function FavouritesPage() {
  return (
    <RequireAuth title="Favourites">
      <div className="flex flex-col">
        <section className="flex flex-col gap-size-1 p-size-2 above-mobile:px-size-5 above-mobile:py-size-3 desktop-up:px-size-15 desktop-up:py-size-5">
          <h1 className="font-inter text-display-small font-bold leading-normal text-on-primary above-mobile:text-display-medium desktop-up:text-display-large">
            Favourites
          </h1>
          <p className="text-body-small font-medium text-on-bg above-mobile:text-body-medium desktop-up:text-body-large">
            Games you saved to come back to
          </p>
        </section>
        <section
          aria-label="Favourite games"
          className="px-size-2 pb-size-5 above-mobile:px-size-5 desktop-up:px-size-15"
        >
          <FavouritesList />
        </section>
      </div>
    </RequireAuth>
  );
}
