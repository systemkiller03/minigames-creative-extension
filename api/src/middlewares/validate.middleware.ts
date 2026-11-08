import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationException } from '@/errors/http-exceptions';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export const validateMiddleware =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    const issues: { in: string; path: string; message: string }[] = [];

    for (const part of ['body', 'query', 'params'] as const) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (result.success) {
        Object.defineProperty(req, part, {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        for (const issue of result.error.issues) {
          issues.push({ in: part, path: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (issues.length > 0) {
      next(new ValidationException('Validation failed', issues));
      return;
    }
    next();
  };
