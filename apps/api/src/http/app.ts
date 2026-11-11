import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { AppConfig } from '../config/env';
import type { Logger } from '../infra/logger';
import { errorHandler, notFoundHandler, tooManyRequests } from './problem';
import { requestLogger } from './request-logger';

export const API_VERSION = '0.1.0';

export type AppDeps = { config: AppConfig; logger: Logger };

export function createApp(deps: AppDeps): Express {
  const app = express();
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

  app.use(notFoundHandler);
  app.use(errorHandler(deps.logger));
  return app;
}
