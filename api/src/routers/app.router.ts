import { Router } from 'express';
import { authRouter } from '@/routers/auth.router';
import { healthRouter } from '@/routers/health.router';

export const appRouter = Router();

appRouter.use('/auth', authRouter);
appRouter.use('/health', healthRouter);
