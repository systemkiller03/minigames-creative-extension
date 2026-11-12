import { Router } from 'express';
import {
  getAuthContext,
  emailCodeRateLimit,
  rateLimit,
  requireAuth,
  requireTrustedOrigin,
  validateMiddleware,
} from '@/middlewares';
import { loginSchema } from '@/schemas/login.schema';
import {
  emailVerificationConfirmSchema,
  emailVerificationRequestSchema,
} from '@/schemas/email-verification.schema';
import {
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  passwordResetVerifySchema,
} from '@/schemas/password-reset.schema';
import { registerSchema } from '@/schemas/register.schema';
import { sessionParamsSchema } from '@/schemas/session.schema';
import { googleCallbackQuerySchema } from '@/schemas/google-oauth.schema';
import { authService } from '@/services/auth.service';
import { googleOAuthService } from '@/services/google-oauth.service';
import { emailVerificationService } from '@/services/email-verification.service';
import { IDLE_TTL_SECONDS } from '@/services/token.service';
import { deviceLabel } from '@/utils/device-label';
import { passwordResetService } from '@/services/password-reset.service';
import { sessionsRepository } from '@/repositories/sessions.repository';
import { clearRefreshCookie, setRefreshCookie } from '@/utils/auth-cookies';
import { REFRESH_COOKIE } from '@/utils/auth-cookies';

export const authRouter = Router();

authRouter.get('/google/login', async (_req, res) => {
  const authorizationUrl = await googleOAuthService.getAuthorizationUrl();
  res.redirect(authorizationUrl);
});

authRouter.get(
  '/google/callback',
  validateMiddleware({ query: googleCallbackQuerySchema }),
  async (req, res) => {
    const query = googleCallbackQuerySchema.parse(req.query);
    const { profile, redirectTarget } = await googleOAuthService.authenticate(query);
    const result = await authService.loginWithGoogle(profile, {
      userAgent: req.get('User-Agent') ?? '',
      ipAddress: req.ip ?? 'unknown',
    });
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresIn, req.baseUrl);
    const frontendRedirect = new URL(redirectTarget);
    frontendRedirect.searchParams.set('provider', 'google');
    frontendRedirect.searchParams.set('status', 'success');
    res.redirect(frontendRedirect.toString());
  },
);

authRouter.post('/register', validateMiddleware({ body: registerSchema }), async (req, res) => {
  await authService.register(req.body);
  res.status(201).json({
    message: 'If the email can be registered, a verification code has been sent to it.',
  });
});

authRouter.post(
  '/verify-email/request',
  validateMiddleware({ body: emailVerificationRequestSchema }),
  emailCodeRateLimit('email-verify', 'request', 10, 60 * 60),
  async (req, res) => {
    const input = req.body;
    res.json({ message: 'If an account exists, a verification code has been sent.' });
    setImmediate(() => void emailVerificationService.requestCode(input));
  },
);

authRouter.post(
  '/verify-email/confirm',
  validateMiddleware({ body: emailVerificationConfirmSchema }),
  emailCodeRateLimit('email-verify', 'attempt', 5, 15 * 60),
  async (req, res) => {
    await emailVerificationService.confirm(req.body);
    res.json({ message: 'Email verified successfully' });
  },
);

authRouter.post(
  '/password-reset/request',
  validateMiddleware({ body: passwordResetRequestSchema }),
  emailCodeRateLimit('password-reset', 'request', 10, 60 * 60),
  async (req, res) => {
    res.json({
      message: 'If an account exists for that email, a reset code has been sent.',
    });
    const input = req.body;
    setImmediate(() => void passwordResetService.requestCode(input));
  },
);

authRouter.post(
  '/password-reset/verify',
  validateMiddleware({ body: passwordResetVerifySchema }),
  emailCodeRateLimit('password-reset', 'attempt', 5, 15 * 60),
  async (req, res) => {
    const resetToken = await passwordResetService.verifyCode(req.body);
    res.json({ message: 'Reset code verified', resetToken });
  },
);

authRouter.post(
  '/password-reset/confirm',
  validateMiddleware({ body: passwordResetConfirmSchema }),
  emailCodeRateLimit('password-reset', 'attempt', 5, 15 * 60),
  async (req, res) => {
    await passwordResetService.confirm(req.body);
    res.json({ message: 'Password reset successful' });
  },
);

authRouter.post(
  '/login',
  rateLimit('login', 10),
  validateMiddleware({ body: loginSchema }),
  async (req, res) => {
    const result = await authService.login(req.body, {
      userAgent: req.get('User-Agent') ?? '',
      ipAddress: req.ip ?? 'unknown',
    });
    const { refreshToken, refreshExpiresIn, ...response } = result;
    setRefreshCookie(res, refreshToken, refreshExpiresIn, req.baseUrl);
    res.status(200).json(response);
  },
);

authRouter.post('/refresh', requireTrustedOrigin, rateLimit('refresh', 30), async (req, res) => {
  const result = await authService.refresh(req.cookies?.[REFRESH_COOKIE], {
    userAgent: req.get('User-Agent') ?? '',
    ipAddress: req.ip ?? 'unknown',
  });
  const { refreshToken, refreshExpiresIn, ...response } = result;
  setRefreshCookie(res, refreshToken, refreshExpiresIn, req.baseUrl);
  res.status(200).json(response);
});

authRouter.get('/sessions', requireAuth, async (req, res) => {
  const auth = getAuthContext(req);
  const sessions = await sessionsRepository.listForUser(auth.userId);
  const idleMs = IDLE_TTL_SECONDS * 1000;
  res.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      device: deviceLabel(session.userAgent),
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: new Date(session.createdAt).toISOString(),
      lastSeenAt: new Date(session.lastSeenAt).toISOString(),
      expiresAt: new Date(
        Math.min(session.lastSeenAt + idleMs, session.maxExpiresAt),
      ).toISOString(),
      isCurrent: session.id === auth.sessionId,
    })),
  });
});

authRouter.delete(
  '/sessions/:sessionId',
  requireAuth,
  validateMiddleware({ params: sessionParamsSchema }),
  async (req, res) => {
    const auth = getAuthContext(req);
    const { sessionId } = sessionParamsSchema.parse(req.params);
    await sessionsRepository.revoke(sessionId, auth.userId);
    if (sessionId === auth.sessionId) clearRefreshCookie(res, req.baseUrl);
    res.sendStatus(204);
  },
);

authRouter.post('/logout', requireAuth, async (req, res) => {
  const auth = getAuthContext(req);
  await authService.logout(auth.userId, auth.sessionId);
  clearRefreshCookie(res, req.baseUrl);
  res.sendStatus(204);
});

authRouter.post('/logout-all', requireAuth, async (req, res) => {
  const auth = getAuthContext(req);
  await sessionsRepository.revokeAllForUser(auth.userId);
  clearRefreshCookie(res, req.baseUrl);
  res.sendStatus(204);
});
