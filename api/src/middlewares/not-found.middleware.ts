import { NotFoundException } from '@/errors/http-exceptions';
import { RequestHandler } from 'express';

export const notFoundMiddleware: RequestHandler = (req, _res, next) => {
  next(new NotFoundException(`Route not found: ${req.method} ${req.path}`));
};
