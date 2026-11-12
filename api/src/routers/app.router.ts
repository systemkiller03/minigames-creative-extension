import { Router } from 'express';
import { authRouter } from '@/routers/auth.router';
import { catalogRouter } from '@/routers/catalog.router';
import { meRouter } from '@/routers/me.router';
import { healthRouter } from '@/routers/health.router';

export const appRouter = Router();

appRouter.use('/auth', authRouter);
appRouter.use('/me', meRouter);
appRouter.use('/catalog', catalogRouter);
appRouter.use('/health', healthRouter);
