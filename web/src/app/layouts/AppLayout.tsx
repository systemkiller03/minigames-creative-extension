import { Outlet, useSearch } from '@tanstack/react-router';
import { AuthDialog } from '@/features/auth/components/AuthDialog';
import { useGoogleReturn } from '@/features/auth/useGoogleReturn';
import { SiteFooter } from '@/features/footer/components/SiteFooter';
import { SiteHeader } from '@/features/header/components/SiteHeader';

export function AppLayout() {
    const { auth } = useSearch({ strict: false });
    useGoogleReturn();

    return (
        <div className="flex min-h-screen flex-col bg-bg font-inter text-on-bg">
            <a
                className="sr-only z-50 rounded-small bg-primary px-size-2 py-size-1 text-on-primary focus:not-sr-only focus:fixed focus:left-size-2 focus:top-size-2"
                href="#main-content"
            >
                Skip to content
            </a>
            <SiteHeader />
            <main id="main-content" className="flex-1">
                <Outlet />
            </main>
            <SiteFooter />
            {auth ? <AuthDialog mode={auth} /> : null}
        </div>
    );
}
