import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { SnackbarProvider } from '@/shared/snackbar/SnackbarProvider';
import { routeTree } from '@/routeTree.gen';
import { jsonResponse } from './utils';

export const SLUGS = ['cast-n-chill', 'camper-van-make-it-home', 'cat-chess'] as const;

export function makeGame(slug: string, overrides: Record<string, unknown> = {}) {
    return {
        slug,
        name: slug.replace(/-/gu, ' '),
        category: 'casual',
        price: 'Free',
        shortDescription: `About ${slug}`,
        rating: 4.5,
        likesCount: 1200,
        cardImage: 'remote.jpg',
        isFavorited: false,
        ...overrides,
    };
}

export const USER = {
    id: 'u1',
    email: 'ann@example.com',
    name: 'Ann',
    createdAt: '2026-01-01T00:00:00Z',
};
export const PROFILE = {
    ...USER,
    emailVerified: true,
    hasPassword: true,
    providers: [] as string[],
};

export type Handler = (url: URL, init: RequestInit) => Response | Promise<Response> | undefined;

type BackendOptions = { signedIn?: boolean; handlers?: Handler[]; totalPages?: number };

/** Installs a fake `fetch` that mimics the API. Extra `handlers` run first and can override anything. */
export function installBackend({
    signedIn = false,
    handlers = [],
    totalPages = 2,
}: BackendOptions = {}) {
    const calls: Array<{ method: string; path: string; body: unknown }> = [];
    const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
        const url = new URL(input, 'http://localhost');
        const path = url.pathname.replace(/^\/api/u, '');
        const method = init.method ?? 'GET';
        calls.push({ method, path, body: init.body ? JSON.parse(init.body as string) : undefined });

        for (const handler of handlers) {
            const response = await handler(url, init);
            if (response) {
                return response;
            }
        }
        if (path === '/auth/refresh') {
            return signedIn ? jsonResponse({ accessToken: 'token' }) : jsonResponse({}, 401);
        }
        if (path === '/auth/logout') {
            return new Response(null, { status: 204 });
        }
        if (path === '/me' && method === 'GET') {
            return jsonResponse({ user: PROFILE });
        }
        if (path === '/catalog/categories') {
            return jsonResponse({
                data: [
                    { slug: 'all', label: 'All', isDefault: true },
                    { slug: 'casual', label: 'Casual', isDefault: false },
                ],
            });
        }
        if (path === '/catalog/leaderboard') {
            return jsonResponse({
                data: [
                    {
                        rank: 1,
                        playerName: 'Alex_Pro99',
                        gamesPlayed: 142,
                        totalScore: 94250,
                        streakDays: 12,
                        favoriteGameName: 'Cast',
                    },
                    {
                        rank: 2,
                        playerName: 'Solo',
                        gamesPlayed: 3,
                        totalScore: 900,
                        streakDays: 1,
                        favoriteGameName: '',
                    },
                ],
            });
        }
        if (path === '/catalog/games' && url.searchParams.get('featured') === 'true') {
            return jsonResponse({ data: SLUGS.map((slug) => makeGame(slug)) });
        }
        if (path === '/catalog/games') {
            const page = Number(url.searchParams.get('page') ?? 1);
            return jsonResponse({
                data: SLUGS.map((slug) => makeGame(slug)),
                meta: { page, limit: 6, totalItems: totalPages * 6, totalPages },
            });
        }
        if (path.startsWith('/catalog/games/')) {
            const slug = decodeURIComponent(path.split('/').pop() ?? '');
            return jsonResponse({
                data: {
                    slug,
                    name: slug.replace(/-/gu, ' '),
                    rating: 4.5,
                    likesCount: 1200,
                    fullDescription: 'Full description',
                    specs: { genre: 'Casual', players: '1', duration: '10 min', price: 'Free' },
                    topRecords: [
                        {
                            position: 1,
                            playerName: 'Alex',
                            score: 1000,
                            achievedAt: '2026-01-01T00:00:00Z',
                        },
                    ],
                },
            });
        }
        if (path.startsWith('/me/favourites/')) {
            return jsonResponse({
                data: {
                    gameSlug: path.split('/').pop(),
                    isFavorited: method === 'PUT',
                    likesCount: 1201,
                },
            });
        }
        if (path === '/me/favourites') {
            return jsonResponse({ data: [makeGame('cast-n-chill', { isFavorited: true })] });
        }
        return jsonResponse(
            { error: { code: 'NOT_FOUND', message: `Unhandled ${method} ${path}` } },
            404,
        );
    });
    vi.stubGlobal('fetch', fetchMock);
    return { fetchMock, calls };
}

export async function renderApp(url = '/') {
    const router = createRouter({
        routeTree,
        history: createMemoryHistory({ initialEntries: [url] }),
    });
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    await router.load();
    const result = render(
        <QueryClientProvider client={queryClient}>
            <SnackbarProvider>
                <AuthProvider>
                    <RouterProvider router={router} />
                </AuthProvider>
            </SnackbarProvider>
        </QueryClientProvider>,
    );
    return { router, queryClient, ...result };
}
