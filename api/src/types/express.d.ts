import type { AuthContext } from '@/repositories/sessions.repository';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
