import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { getButtonClassName } from '@/shared/components/Button';
import { LoadingState } from '@/shared/components/LoadingState';
import { useAuth } from '../AuthProvider';

/** Renders its children for signed-in users and a login prompt for guests. */
export function RequireAuth({ title, children }: { title: string; children: ReactNode }) {
    const { status } = useAuth();

    if (status === 'loading') {
        return <LoadingState label="Loading..." />;
    }

    if (status === 'guest') {
        return (
            <div className="flex flex-col items-center gap-size-2 px-size-2 py-size-10 text-center">
                <h1 className="text-display-small font-bold text-on-primary">{title}</h1>
                <p className="text-body-medium text-on-bg">Log in to see this page.</p>
                <Link
                    className={getButtonClassName('primary', 'lg')}
                    search={(previous) => ({ ...previous, auth: 'login' })}
                    to="."
                >
                    Log In
                </Link>
            </div>
        );
    }

    return children;
}
