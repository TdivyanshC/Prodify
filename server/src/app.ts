import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { env, isDev } from './config/env';
import { getDb } from './db/mongo';
import { requireUser } from './middleware/auth';
import { errorHandler, notFoundHandler, rateLimit, requestId } from './middleware/common';
import { devRoutes } from './modules/dev/routes';
import { mascotRoutes, notificationRoutes } from './modules/notifications/routes';
import { sessionRoutes } from './modules/sessions/routes';
import { socialRoutes } from './modules/social/routes';
import { spaceRoutes } from './modules/spaces/routes';
import { authRoutes, catalogRoutes, meRoutes } from './modules/users/routes';

// Express app without listen() (backend doc §2) — server.ts attaches
// Socket.IO and listens; tests mount this directly.
export function createApp() {
  const app = express();
  const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim());

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  // Native apps send no Origin; browsers must be on the allowlist.
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin) || origins.includes('*')) }));
  app.use(express.json({ limit: '100kb' }));
  app.use(requestId);

  app.get('/healthz', async (_req, res) => {
    await getDb().command({ ping: 1 });
    res.json({ ok: true, mongo: 'up', time: new Date().toISOString() });
  });

  const v1 = Router();
  v1.use('/auth', authRoutes);
  v1.use(catalogRoutes); // /categories, /badges — public catalog
  if (isDev) v1.use('/dev', (req, res, next) => (req.path === '/accounts' ? next() : requireUser(req, res, next)), devRoutes);

  const authed = Router();
  authed.use(requireUser);
  authed.use(rateLimit('api', 600, 60_000));
  authed.use('/me', meRoutes);
  authed.use('/spaces', spaceRoutes);
  authed.use('/sessions', sessionRoutes);
  authed.use('/notifications', notificationRoutes);
  authed.use('/mascot', mascotRoutes);
  authed.use(socialRoutes); // /friendships, /friends/*, /users/*, /blocks, /reactions, /reports
  v1.use(authed);

  app.use('/v1', v1);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
