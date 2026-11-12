import { Router } from 'express';
import { getAuthContext, rateLimit, requireAuth, validateMiddleware } from '@/middlewares';
import { changePasswordSchema, updateProfileSchema } from '@/schemas/me.schema';
import { sessionParamsSchema } from '@/schemas/session.schema';
import { sessionsRepository } from '@/repositories/sessions.repository';
import { meService } from '@/services/me.service';
import { IDLE_TTL_SECONDS } from '@/services/token.service';
import { authCookiePathFrom, clearRefreshCookie } from '@/utils/auth-cookies';
import { deviceLabel } from '@/utils/device-label';

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get('/', async (req, res) => {
  res.json({ user: await meService.getProfile(getAuthContext(req).userId) });
});

meRouter.patch('/', validateMiddleware({ body: updateProfileSchema }), async (req, res) => {
  res.json({ user: await meService.updateProfile(getAuthContext(req).userId, req.body) });
});

meRouter.post(
  '/password',
  rateLimit('password-change', 5),
  validateMiddleware({ body: changePasswordSchema }),
  async (req, res) => {
    await meService.changePassword(getAuthContext(req).userId, req.body);
    clearRefreshCookie(res, authCookiePathFrom(req));
    res.sendStatus(204);
  },
);

meRouter.get('/sessions', async (req, res) => {
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

meRouter.delete('/sessions', async (req, res) => {
  const auth = getAuthContext(req);
  await meService.revokeOtherSessions(auth.userId, auth.sessionId);
  res.sendStatus(204);
});

meRouter.delete(
  '/sessions/:sessionId',
  validateMiddleware({ params: sessionParamsSchema }),
  async (req, res) => {
    const auth = getAuthContext(req);
    const { sessionId } = sessionParamsSchema.parse(req.params);
    await sessionsRepository.revoke(sessionId, auth.userId);
    if (sessionId === auth.sessionId) clearRefreshCookie(res, authCookiePathFrom(req));
    res.sendStatus(204);
  },
);
