import { useQueryClient } from '@tanstack/react-query';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { refreshAccessToken, setAccessToken, setSessionExpiredHandler } from '@/shared/api/client';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';
import {
    getProfile,
    login as loginRequest,
    logout as logoutRequest,
    type AuthUser,
} from './api/auth.api';

type AuthStatus = 'loading' | 'authenticated' | 'guest';

type AuthContextValue = {
    status: AuthStatus;
    user: AuthUser | null;
    signIn: (credentials: { email: string; password: string }) => Promise<AuthUser>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const snackbar = useSnackbar();
    const [status, setStatus] = useState<AuthStatus>('loading');
    const [user, setUser] = useState<AuthUser | null>(null);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const token = await refreshAccessToken();
            if (cancelled) {
                return;
            }
            if (!token) {
                setStatus('guest');
                return;
            }
            try {
                const profile = await getProfile();
                if (!cancelled) {
                    setUser(profile);
                    setStatus('authenticated');
                }
            } catch {
                if (!cancelled) {
                    setAccessToken(null);
                    setStatus('guest');
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        setSessionExpiredHandler(() => {
            setUser(null);
            setStatus('guest');
            void queryClient.invalidateQueries();
            snackbar.error('Your session has expired. Please log in again.');
        });
        return () => setSessionExpiredHandler(null);
    }, [queryClient, snackbar]);

    const signIn = useCallback<AuthContextValue['signIn']>(
        async (credentials) => {
            const result = await loginRequest(credentials);
            setAccessToken(result.accessToken);
            setUser(result.user);
            setStatus('authenticated');
            await queryClient.invalidateQueries();
            return result.user;
        },
        [queryClient],
    );

    const signOut = useCallback<AuthContextValue['signOut']>(async () => {
        try {
            await logoutRequest();
        } finally {
            setAccessToken(null);
            setUser(null);
            setStatus('guest');
            await queryClient.invalidateQueries();
        }
    }, [queryClient]);

    const value = useMemo(
        () => ({ status, user, signIn, signOut }),
        [status, user, signIn, signOut],
    );

    return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
