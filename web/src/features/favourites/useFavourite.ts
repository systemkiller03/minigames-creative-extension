import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { ApiError } from '@/shared/api/client';
import { setFavourite, type Game, type GamesPage } from '@/shared/api/games.api';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';

type Cached = GamesPage | Game[] | undefined;

function patchGame(game: Game, slug: string, isFavorited: boolean): Game {
  if (game.slug !== slug || game.isFavorited === isFavorited) {
    return game;
  }
  return {
    ...game,
    isFavorited,
    likesCount: Math.max(0, game.likesCount + (isFavorited ? 1 : -1)),
  };
}

function patchCache(cached: Cached, slug: string, isFavorited: boolean): Cached {
  if (!cached) {
    return cached;
  }
  if (Array.isArray(cached)) {
    return cached.map((game) => patchGame(game, slug, isFavorited));
  }
  return { ...cached, games: cached.games.map((game) => patchGame(game, slug, isFavorited)) };
}

/** Add or remove a game from the user's favourites, with an optimistic update and rollback. */
export function useFavourite() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const { status } = useAuth();

  const mutation = useMutation({
    mutationFn: ({ slug, favourite }: { slug: string; favourite: boolean }) =>
      setFavourite(slug, favourite),
    onMutate: async ({ slug, favourite }) => {
      await queryClient.cancelQueries({ queryKey: ['games'] });
      const snapshots = queryClient.getQueriesData<Cached>({ queryKey: ['games'] });
      queryClient.setQueriesData<Cached>({ queryKey: ['games', 'page'] }, (cached) =>
        patchCache(cached, slug, favourite),
      );
      queryClient.setQueriesData<Cached>({ queryKey: ['games', 'featured'] }, (cached) =>
        patchCache(cached, slug, favourite),
      );
      return { snapshots };
    },
    onError: (error, { favourite }, context) => {
      context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
      snackbar.error(
        error instanceof ApiError && error.status !== 401
          ? error.message
          : `Could not ${favourite ? 'add to' : 'remove from'} favourites. Please try again.`,
      );
    },
    onSuccess: (state, { favourite }) => {
      snackbar.success(favourite ? 'Added to your favourites.' : 'Removed from your favourites.');
      void queryClient.invalidateQueries({ queryKey: ['favourites'] });
      void queryClient.invalidateQueries({ queryKey: ['games', 'details', state.gameSlug] });
    },
  });

  const toggle = (slug: string, isFavorited: boolean): void => {
    if (status !== 'authenticated') {
      snackbar.info('Log in to save games to your favourites.');
      void navigate({ to: '.', search: (previous) => ({ ...previous, auth: 'login' }) });
      return;
    }
    mutation.mutate({ slug, favourite: !isFavorited });
  };

  return { toggle, isPending: mutation.isPending };
}
