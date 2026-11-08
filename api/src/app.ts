import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { notFoundMiddleware, errorMiddleware } from '@/middlewares';
import { corsMiddleware } from '@/middlewares/cors.middleware';
import { appRouter } from '@/routers/app.router';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 2);

  app.use(corsMiddleware);
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use('/api', appRouter);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
  return app;
}
