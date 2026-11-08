import { Router } from 'express';
import { healthRouter } from '@/routers/health.router';

export const appRouter = Router();

appRouter.use('/health', healthRouter);
