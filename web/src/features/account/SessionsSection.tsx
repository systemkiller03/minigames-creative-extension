import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSessions, revokeOtherSessions, revokeSession } from '@/features/auth/api/auth.api';
import { errorMessage } from '@/features/auth/components/authForm';
import { ErrorState } from '@/shared/components/ErrorState';
import { Icon } from '@/shared/components/Icon';
import { LoadingState } from '@/shared/components/LoadingState';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';
import { formatRelativeTime } from '@/shared/utils/format';
import { Section, SECTION_BUTTON } from './Section';

const KEY = ['me', 'sessions'] as const;

export function SessionsSection() {
    const queryClient = useQueryClient();
    const snackbar = useSnackbar();
    const query = useQuery({ queryKey: KEY, queryFn: ({ signal }) => getSessions(signal) });

    const revokeOne = useMutation({
        mutationFn: revokeSession,
        onSuccess: () => {
            snackbar.success('Device logged out.');
            void queryClient.invalidateQueries({ queryKey: KEY });
        },
        onError: (error) => snackbar.error(errorMessage(error, 'Could not log out that device.')),
    });
    const revokeOthers = useMutation({
        mutationFn: revokeOtherSessions,
        onSuccess: () => {
            snackbar.success('Logged out on all other devices.');
            void queryClient.invalidateQueries({ queryKey: KEY });
        },
        onError: (error) => snackbar.error(errorMessage(error, 'Could not log out other devices.')),
    });

    const sessions = query.data ?? [];
    const hasOthers = sessions.some((session) => !session.isCurrent);

    return (
        <Section
            description="Devices that are currently signed in to your account."
            id="sessions-title"
            title="Devices"
        >
            {query.isPending ? (
                <LoadingState label="Loading devices..." />
            ) : query.isError ? (
                <ErrorState
                    message="We couldn't load your devices."
                    onRetry={() => void query.refetch()}
                />
            ) : (
                <>
                    <ul className="flex list-none flex-col gap-size-2">
                        {sessions.map((session) => (
                            <li
                                className="flex flex-wrap items-center justify-between gap-size-2 rounded-small border border-solid border-outline-variant p-size-2"
                                key={session.id}
                            >
                                <div className="flex min-w-0 items-center gap-size-2">
                                    <Icon className="text-[24px] text-on-bg" name="devices" />
                                    <div className="flex min-w-0 flex-col">
                                        <span className="flex items-center gap-size-1 text-label-large font-bold text-on-primary">
                                            <span className="truncate">{session.device}</span>
                                            {session.isCurrent ? (
                                                <span className="shrink-0 rounded-extra-large border-button-hover border-solid border-on-primary bg-secondary px-size-1 text-label-medium">
                                                    This device
                                                </span>
                                            ) : null}
                                        </span>
                                        <span className="truncate text-label-medium text-on-bg">
                                            {session.ipAddress} · active{' '}
                                            {formatRelativeTime(session.lastSeenAt) || 'just now'}
                                        </span>
                                    </div>
                                </div>
                                {session.isCurrent ? null : (
                                    <button
                                        className={`${SECTION_BUTTON} h-10 bg-white hover:bg-surface`}
                                        disabled={revokeOne.isPending}
                                        onClick={() => revokeOne.mutate(session.id)}
                                        type="button"
                                    >
                                        Log out
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                    {hasOthers ? (
                        <button
                            className={`${SECTION_BUTTON} self-start bg-white hover:bg-surface`}
                            disabled={revokeOthers.isPending}
                            onClick={() => revokeOthers.mutate()}
                            type="button"
                        >
                            Log out other devices
                        </button>
                    ) : null}
                </>
            )}
        </Section>
    );
}
