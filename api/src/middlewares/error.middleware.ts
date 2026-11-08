import type { ErrorRequestHandler } from 'express';
import { BaseError, ErrorCode } from '@/errors/base-error';

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof BaseError) {
    if (err.headers) res.set(err.headers);
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    });
    return;
  }

  if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    err.type === 'entity.parse.failed'
  ) {
    res.status(400).json({
      error: { code: ErrorCode.VALIDATION_ERROR, message: 'Malformed JSON body' },
    });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: ErrorCode.INTERNAL, message: 'Internal server error' } });
};
