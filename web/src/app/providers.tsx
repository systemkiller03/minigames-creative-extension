import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { SnackbarProvider } from '@/shared/snackbar/SnackbarProvider';
import { router } from './router';
import { queryClient } from './query-client';

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </SnackbarProvider>
    </QueryClientProvider>
  );
}
