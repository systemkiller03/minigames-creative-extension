import { randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { env } from '@/config/env';
import {
  ServiceUnavailableException,
  UnauthorizedException,
  UpstreamException,
} from '@/errors/http-exceptions';
import type { GoogleCallbackQuery } from '@/schemas/google-oauth.schema';
import { redis } from '@/providers/redis';

const STATE_TTL_SECONDS = 5 * 60;
const STATE_PREFIX = 'oauth:google:state:';
const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const consumeStateScript = `
  local value = redis.call('GET', KEYS[1])
  if value then redis.call('DEL', KEYS[1]) end
  return value
`;

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  frontendRedirectUrl: string;
};

type OAuthState = {
  createdAt: number;
  redirectTarget: string;
};

export type VerifiedGoogleProfile = {
  subject: string;
  email: string;
  name: string;
};

function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    FRONTEND_AUTH_REDIRECT_URL,
  } = env;

  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GOOGLE_REDIRECT_URI ||
    !FRONTEND_AUTH_REDIRECT_URL
  ) {
    throw new ServiceUnavailableException('Google sign-in is not configured');
  }

  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: GOOGLE_REDIRECT_URI,
    frontendRedirectUrl: FRONTEND_AUTH_REDIRECT_URL,
  };
}

function normalizeGoogleName(name: string | null | undefined, email: string) {
  const candidate = name?.trim() || email.split('@')[0] || 'Google user';
  const normalized = Array.from(candidate).slice(0, 30).join('');
  return Array.from(normalized).length >= 2 ? normalized : 'Google user';
}

export class GoogleOAuthService {
  async getAuthorizationUrl() {
    const config = getGoogleOAuthConfig();
    const state = randomBytes(32).toString('base64url');
    const stateEntry: OAuthState = {
      createdAt: Date.now(),
      redirectTarget: config.frontendRedirectUrl,
    };
    const stored = await redis.set(
      `${STATE_PREFIX}${state}`,
      JSON.stringify(stateEntry),
      'EX',
      STATE_TTL_SECONDS,
      'NX',
    );

    if (stored !== 'OK') throw new Error('Unable to store Google OAuth state');

    const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', 'openid email profile');
    authorizationUrl.searchParams.set('state', state);

    return authorizationUrl.toString();
  }

  async authenticate(query: GoogleCallbackQuery) {
    const config = getGoogleOAuthConfig();
    const state = await this.consumeState(query.state);

    if (state.redirectTarget !== config.frontendRedirectUrl) {
      throw new UnauthorizedException('Invalid Google OAuth state');
    }
    if (query.error) {
      throw new UnauthorizedException('Google sign-in was not completed');
    }
    if (!query.code) {
      throw new UnauthorizedException('Google authorization code is missing');
    }

    const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
    let idToken: string | null | undefined;

    try {
      const { tokens } = await client.getToken(query.code);
      idToken = tokens.id_token;
    } catch {
      throw new UpstreamException('Google authorization code exchange failed');
    }

    if (!idToken) throw new UnauthorizedException('Google ID token is missing');

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: config.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google ID token validation failed');
    }

    const email = payload?.email?.trim().toLowerCase();
    if (
      !payload?.sub ||
      !email ||
      !z.email().safeParse(email).success ||
      payload.email_verified !== true
    ) {
      throw new UnauthorizedException('Google account does not have a verified email');
    }

    return {
      profile: {
        subject: payload.sub,
        email,
        name: normalizeGoogleName(payload.name, email),
      } satisfies VerifiedGoogleProfile,
      redirectTarget: state.redirectTarget,
    };
  }

  private async consumeState(value: string): Promise<OAuthState> {
    const stored = await redis.eval(consumeStateScript, 1, `${STATE_PREFIX}${value}`);
    if (typeof stored !== 'string') {
      throw new UnauthorizedException('Invalid or expired Google OAuth state');
    }

    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('createdAt' in parsed) ||
      typeof parsed.createdAt !== 'number' ||
      !('redirectTarget' in parsed) ||
      typeof parsed.redirectTarget !== 'string'
    ) {
      throw new Error('Stored Google OAuth state is malformed');
    }

    return {
      createdAt: parsed.createdAt,
      redirectTarget: parsed.redirectTarget,
    };
  }
}

export const googleOAuthService = new GoogleOAuthService();
