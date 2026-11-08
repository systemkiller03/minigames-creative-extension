import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { notFoundMiddleware, errorMiddleware } from '@/middlewares';

export function createApp() {
  const app = express();

  app.set('trust proxy', 2);

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
  return app;
}
