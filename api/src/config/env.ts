import { z } from 'zod';

const httpUrl = z.url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    /** Number of reverse proxies in front of the API; the client IP is read that many hops back. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(2),
    UPSTREAM_BASE_URL: z.string().min(1),
    UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    /** Domain of the synthetic per-user email sent upstream (never a real mailbox). */
    UPSTREAM_EMAIL_DOMAIN: z
      .string()
      .regex(/^[a-z0-9.-]+$/i)
      .default('minigames-gateway.invalid'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_REDIRECT_URI: httpUrl.optional(),
    FRONTEND_AUTH_REDIRECT_URL: httpUrl.optional(),
    SMTP_HOST: z.string().min(1).default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_FROM: z.string().min(1).default('no-reply@minigames.local'),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((value) => value.split(',').map((origin) => origin.trim()))
      .pipe(
        z
          .array(
            z.url().refine((value) => {
              try {
                const url = new URL(value);
                return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
              } catch {
                return false;
              }
            }, 'Must be an origin with no path, query, or fragment'),
          )
          .min(1),
      ),
  })
  .superRefine((value, context) => {
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
      });
    }

    const googleOAuthValues = [
      value.GOOGLE_CLIENT_ID,
      value.GOOGLE_CLIENT_SECRET,
      value.GOOGLE_REDIRECT_URI,
      value.FRONTEND_AUTH_REDIRECT_URL,
    ];
    const configuredValues = googleOAuthValues.filter(Boolean).length;

    if (configuredValues > 0 && configuredValues < googleOAuthValues.length) {
      context.addIssue({
        code: 'custom',
        path: ['GOOGLE_CLIENT_ID'],
        message:
          'Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and FRONTEND_AUTH_REDIRECT_URL together',
      });
    }

    if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASSWORD)) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_USER'],
        message: 'Configure SMTP_USER and SMTP_PASSWORD together',
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
