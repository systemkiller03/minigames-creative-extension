import { vi } from 'vitest';

// Load the developer's .env (Compose Postgres and Redis); tests use unique emails and
// never flush either store.
try {
  process.loadEnvFile('.env');
} catch {
  // CI provides the variables directly.
}
// Vitest sets NODE_ENV=test, which the app's env schema does not accept.
process.env.NODE_ENV = 'development';
process.env.CORS_ORIGINS ||= 'http://localhost:5173';

type Mail = { kind: 'verify' | 'reset'; email: string; code: string };
const outbox: Mail[] = ((globalThis as { __outbox?: Mail[] }).__outbox ??= []);

// Capture emails instead of sending them through SMTP.
vi.mock('@/services/email.service', () => ({
  emailService: {
    sendEmailVerificationCode: async (email: string, code: string) => {
      outbox.push({ kind: 'verify', email, code });
    },
    sendPasswordResetCode: async (email: string, code: string) => {
      outbox.push({ kind: 'reset', email, code });
    },
  },
}));
