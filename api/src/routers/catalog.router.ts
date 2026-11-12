import { Router } from 'express';
import { optionalAuth, rateLimit, validateMiddleware } from '@/middlewares';
import { gameParamsSchema, gamesQuerySchema } from '@/schemas/catalog.schema';
import { catalogService } from '@/services/catalog.service';

export const catalogRouter = Router();

// Public. A bearer token is optional and only adds per-user fields.
catalogRouter.use(optionalAuth, rateLimit('catalog', 120));

catalogRouter.get('/categories', async (_req, res) => {
  res.json(await catalogService.getCategories());
});

catalogRouter.get('/leaderboard', async (_req, res) => {
  res.json(await catalogService.getLeaderboard());
});

catalogRouter.get('/games', validateMiddleware({ query: gamesQuerySchema }), async (req, res) => {
  const query = gamesQuerySchema.parse(req.query);
  res.json(await catalogService.listGames(query, req.auth?.userId));
});

catalogRouter.get(
  '/games/:slug',
  validateMiddleware({ params: gameParamsSchema }),
  async (req, res) => {
    const { slug } = gameParamsSchema.parse(req.params);
    res.json(await catalogService.getGame(slug, req.auth?.userId));
  },
);
