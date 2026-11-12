import type { AccessClaims } from '@/services/token.service';

declare global {
  namespace Express {
    interface Request {
      auth?: AccessClaims;
    }
  }
}

export {};
