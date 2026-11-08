import { BaseError, ErrorCode } from '@/errors/base-error';

export class ValidationException extends BaseError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(400, ErrorCode.VALIDATION_ERROR, message, details);
  }
}

export class UnauthorizedException extends BaseError {
  constructor(message = 'Authentication required') {
    super(401, ErrorCode.UNAUTHORIZED, message);
  }
}

export class ForbiddenException extends BaseError {
  constructor(message = 'Forbidden') {
    super(403, ErrorCode.FORBIDDEN, message);
  }
}

export class NotFoundException extends BaseError {
  constructor(message = 'Not found') {
    super(404, ErrorCode.NOT_FOUND, message);
  }
}

export class ConflictException extends BaseError {
  constructor(message = 'Conflict') {
    super(409, ErrorCode.CONFLICT, message);
  }
}

export class TooManyRequestsException extends BaseError {
  constructor(retryAfterSeconds: number, message = 'Too many requests') {
    super(429, ErrorCode.RATE_LIMITED, message, undefined, {
      'Retry-After': String(retryAfterSeconds),
    });
  }
}

export class UpstreamException extends BaseError {
  constructor(message = 'Upstream service error') {
    super(502, ErrorCode.UPSTREAM_ERROR, message);
  }
}
