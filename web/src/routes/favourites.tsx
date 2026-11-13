import { createFileRoute } from '@tanstack/react-router';
import { FavouritesPage } from '@/features/favourites/FavouritesPage';

export const Route = createFileRoute('/favourites')({
  component: FavouritesPage,
});
