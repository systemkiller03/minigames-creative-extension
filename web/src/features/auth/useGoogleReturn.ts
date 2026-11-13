import { useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';

/** Handles the `?provider=google&status=…` redirect the API sends after Google sign-in. */
export function useGoogleReturn(): void {
  const { provider, status } = useSearch({ strict: false });
  const navigate = useNavigate();
  const snackbar = useSnackbar();

  useEffect(() => {
    if (provider !== 'google') {
      return;
    }
    if (status === 'success') {
      snackbar.success('You are signed in with Google.');
    } else {
      snackbar.error('Google sign-in failed. Please try again.');
    }
    void navigate({
      to: '.',
      search: (previous) => ({ ...previous, provider: undefined, status: undefined }),
      replace: true,
    });
  }, [provider, status, navigate, snackbar]);
}
