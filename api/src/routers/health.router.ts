import { Router } from 'express';
import { getHealth } from '@/services/health.service';

export const healthRouter = Router();

healthRouter.get('', async (_req, res) => {
  const { healthy, checks } = await getHealth();
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks });
});
