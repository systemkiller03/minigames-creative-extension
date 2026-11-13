import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { z } from 'zod';
import { renderWithProviders } from './utils';

const searchSchema = z.object({
  category: z.string().optional(),
  sort: z.string().optional(),
  page: z.coerce.number().optional(),
  game: z.string().optional(),
  auth: z.enum(['login', 'register']).optional(),
  provider: z.string().optional(),
  status: z.string().optional(),
});

/** Render `ui` as the component of a root route inside a memory router. */
export async function renderWithRouter(ui: ReactElement, url = '/') {
  const root = createRootRoute({
    validateSearch: searchSchema,
    component: () => (
      <>
        {ui}
        <Outlet />
      </>
    ),
  });
  const routes = ['/', '/library', '/favourites', '/account'].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: () => null }),
  );
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  await router.load();
  const result = renderWithProviders(<RouterProvider router={router} />);
  return { router, ...result };
}

export { render };
