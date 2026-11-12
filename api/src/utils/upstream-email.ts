import { env } from '@/config/env';

/** The identity the upstream sees for a user: stable, unguessable by clients, never a real email. */
export function upstreamEmailFor(userId: string) {
  return `u-${userId}@${env.UPSTREAM_EMAIL_DOMAIN}`;
}
