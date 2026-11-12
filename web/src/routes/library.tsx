import { createFileRoute } from '@tanstack/react-router';
import { LibraryPage } from '@/features/library/components/LibraryPage';

export const Route = createFileRoute('/library')({
  component: LibraryPage,
});
