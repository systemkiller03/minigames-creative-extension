import { Router } from 'express';
import {
  getAuthContext,
  optionalAuth,
  rateLimit,
  requireAuth,
  validateMiddleware,
} from '@/middlewares';
import {
  commentParamsSchema,
  commentsQuerySchema,
  createCommentSchema,
  gameParamsSchema,
  gamesQuerySchema,
} from '@/schemas/catalog.schema';
import { catalogService } from '@/services/catalog.service';
import { commentsService } from '@/services/comments.service';

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

catalogRouter.get(
  '/games/:slug/comments',
  validateMiddleware({ params: gameParamsSchema, query: commentsQuerySchema }),
  async (req, res) => {
    const { slug } = gameParamsSchema.parse(req.params);
    const query = commentsQuerySchema.parse(req.query);
    res.json(await commentsService.list(slug, query, req.auth?.userId));
  },
);

catalogRouter.post(
  '/games/:slug/comments',
  requireAuth,
  rateLimit('comment', 10),
  validateMiddleware({ params: gameParamsSchema, body: createCommentSchema }),
  async (req, res) => {
    const { slug } = gameParamsSchema.parse(req.params);
    const { text } = createCommentSchema.parse(req.body);
    res.status(201).json(await commentsService.create(getAuthContext(req).userId, slug, text));
  },
);

catalogRouter.post(
  '/comments/:commentId/like',
  requireAuth,
  rateLimit('comment-like', 60),
  validateMiddleware({ params: commentParamsSchema }),
  async (req, res) => {
    const { commentId } = commentParamsSchema.parse(req.params);
    res.json(await commentsService.toggleLike(getAuthContext(req).userId, commentId));
  },
);
