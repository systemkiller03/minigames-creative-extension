import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  UPSTREAM_BASE_URL: z.string().min(1),
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
