import type { RequestHandler } from 'express';
import { env } from '@/config/env';

export const corsMiddleware: RequestHandler = (req, res, next) => {
  const origin = req.get('Origin');
  res.vary('Origin');

  if (origin && env.CORS_ORIGINS.includes(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
      'Access-Control-Max-Age': '600',
    });
  } else if (origin && req.method === 'OPTIONS') {
    res.sendStatus(403);
    return;
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
};
