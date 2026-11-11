import cors from 'cors';
import express, { Router, type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { cronRouter } from '../modules/demo/cron.routes';
import { authOf, requireAuth } from './auth';
import { buildContainer } from './container';
import type { AppDeps } from './deps';
import { errorHandler, notFoundHandler, tooManyRequests } from './problem';
import { requestLogger } from './request-logger';
import { registerRoutes } from './routes';

export type { AppDeps } from './deps';

export const API_VERSION = '0.1.0';

export function createApp(deps: AppDeps): Express {
  const app = express();
  const container = buildContainer(deps);

  app.disable('x-powered-by');
  app.use(requestLogger(deps.logger));
  app.use(helmet());
  app.use(cors({ origin: deps.config.WEB_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => deps.config.NODE_ENV === 'test',
      handler: tooManyRequests,
    }),
  );

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', version: API_VERSION });
  });

  app.use('/api/v1/internal/cron', cronRouter({ secret: deps.config.CRON_SECRET, demo: container.demo }));

  const api = Router();
  api.use(requireAuth(deps.verifier));
  api.use(async (_req, res, next) => {
    await container.provisioner.ensure(authOf(res));
    next();
  });
  registerRoutes(api, container, { rateLimitEnabled: deps.config.NODE_ENV !== 'test' });
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler(deps.logger));
  return app;
}
