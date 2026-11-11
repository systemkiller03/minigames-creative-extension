import { createRootRoute, notFound, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { AppLayout } from '@/app/layouts/AppLayout';
import { NotFound } from '@/app/components/NotFound';
import { RouteError } from '@/app/components/RouteError';
import { RoutePending } from '@/app/components/RoutePending';

const sortKeys = ['rating-desc', 'rating-asc', 'name-asc', 'name-desc'] as const;

const appSearchSchema = z.object({
    route: z.string().optional(),
    category: z.string().trim().min(1).optional(),
    sort: z.enum(sortKeys).catch('rating-desc').optional(),
    page: z.coerce.number().int().positive().catch(1).optional(),
    game: z.string().trim().min(1).optional(),
    auth: z.enum(['login', 'register']).optional(),
});

export const Route = createRootRoute({
    validateSearch: appSearchSchema,
    beforeLoad: ({ search }) => {
        if (!search.route) {
            return;
        }

        const legacyRoute = search.route.replace(/^\/+|\/+$/gu, '');
        const target =
            legacyRoute === 'library'
                ? '/library'
                : legacyRoute === '' || legacyRoute === 'home'
                  ? '/'
                  : null;

        if (!target) {
            throw notFound();
        }

        const { route: _route, ...preservedSearch } = search;
        throw redirect({
            to: target,
            search: preservedSearch,
            replace: true,
        });
    },
    component: AppLayout,
    errorComponent: RouteError,
    notFoundComponent: NotFound,
    pendingComponent: RoutePending,
});
