import { Router } from 'express';
import {
  getAuthContext,
  rateLimit,
  requireAuth,
  requireTrustedOrigin,
  validateMiddleware,
} from '@/middlewares';
import { loginSchema } from '@/schemas/login.schema';
import { registerSchema } from '@/schemas/register.schema';
import { sessionParamsSchema } from '@/schemas/session.schema';
import { authService } from '@/services/auth.service';
import { sessionsRepository } from '@/repositories/sessions.repository';
import { clearAuthCookies, setAuthCookies, setCsrfCookie } from '@/utils/auth-cookies';

export const authRouter = Router();

authRouter.post('/register', validateMiddleware({ body: registerSchema }), async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json({ user });
});

authRouter.post(
  '/login',
  rateLimit('login', 10),
  validateMiddleware({ body: loginSchema }),
  async (req, res) => {
    const result = await authService.login(req.body, {
      userAgent: req.get('User-Agent') ?? '',
      ipAddress: req.ip ?? 'unknown',
    });
    const { refreshToken, csrfToken, refreshExpiresIn, ...response } = result;
    setAuthCookies(res, refreshToken, csrfToken, refreshExpiresIn);
    res.status(200).json({ ...response, csrfToken });
  },
);

authRouter.post('/csrf', requireTrustedOrigin, rateLimit('refresh', 30), async (req, res) => {
  const result = await authService.issueCsrfToken(req.cookies?.refresh_token);
  setCsrfCookie(res, result.csrfToken, result.refreshExpiresIn);
  res.json({ csrfToken: result.csrfToken });
});

authRouter.post('/refresh', requireTrustedOrigin, rateLimit('refresh', 30), async (req, res) => {
  const result = await authService.refresh(
    req.cookies?.refresh_token,
    req.cookies?.csrf_token,
    req.get('X-CSRF-Token'),
    {
      userAgent: req.get('User-Agent') ?? '',
      ipAddress: req.ip ?? 'unknown',
    },
  );
  const { refreshToken, csrfToken, refreshExpiresIn, ...response } = result;
  setAuthCookies(res, refreshToken, csrfToken, refreshExpiresIn);
  res.status(200).json({ ...response, csrfToken });
});

authRouter.get('/sessions', requireAuth, async (req, res) => {
  const auth = getAuthContext(req);
  const sessions = await sessionsRepository.listForUser(auth.userId);
  res.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: new Date(session.createdAt).toISOString(),
      lastSeenAt: new Date(session.lastSeenAt).toISOString(),
      expiresAt: new Date(Math.min(session.idleExpiresAt, session.maxExpiresAt)).toISOString(),
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
    if (sessionId === auth.sessionId) clearAuthCookies(res);
    res.sendStatus(204);
  },
);

authRouter.post('/logout', requireAuth, async (req, res) => {
  const auth = getAuthContext(req);
  await sessionsRepository.revoke(auth.sessionId, auth.userId);
  clearAuthCookies(res);
  res.sendStatus(204);
});

authRouter.post('/logout-all', requireAuth, async (req, res) => {
  const auth = getAuthContext(req);
  await sessionsRepository.revokeAllForUser(auth.userId);
  clearAuthCookies(res);
  res.sendStatus(204);
});
