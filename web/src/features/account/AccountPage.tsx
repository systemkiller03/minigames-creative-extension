import { useQuery } from '@tanstack/react-query';
import { getProfile } from '@/features/auth/api/auth.api';
import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { ErrorState } from '@/shared/components/ErrorState';
import { LoadingState } from '@/shared/components/LoadingState';
import { DeleteAccountSection } from './DeleteAccountSection';
import { PasswordSection } from './PasswordSection';
import { ProfileSection } from './ProfileSection';
import { SessionsSection } from './SessionsSection';

function AccountSections() {
    const query = useQuery({
        queryKey: ['me', 'profile'],
        queryFn: ({ signal }) => getProfile(signal),
    });

    if (query.isPending) {
        return <LoadingState label="Loading your account..." />;
    }
    if (query.isError) {
        return (
            <ErrorState
                message="We couldn't load your account. Please try again."
                onRetry={() => void query.refetch()}
            />
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-size-3">
            <ProfileSection profile={query.data} />
            <PasswordSection profile={query.data} />
            <SessionsSection />
            <DeleteAccountSection profile={query.data} />
        </div>
    );
}

export function AccountPage() {
    return (
        <RequireAuth title="Account">
            <div className="flex flex-col">
                <section className="flex flex-col gap-size-1 p-size-2 above-mobile:px-size-5 above-mobile:py-size-3 desktop-up:px-size-15 desktop-up:py-size-5">
                    <h1 className="font-inter text-display-small font-bold leading-normal text-on-primary above-mobile:text-display-medium desktop-up:text-display-large">
                        Account
                    </h1>
                    <p className="text-body-small font-medium text-on-bg above-mobile:text-body-medium desktop-up:text-body-large">
                        Manage your profile, password and devices
                    </p>
                </section>
                <section
                    aria-label="Account settings"
                    className="px-size-2 pb-size-5 above-mobile:px-size-5 desktop-up:px-size-15"
                >
                    <AccountSections />
                </section>
            </div>
        </RequireAuth>
    );
}
