import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authOf } from '../../http/auth';
import { tooManyRequests } from '../../http/problem';
import type { DemoService } from './demo.service';

export function demoRouter(service: DemoService, opts: { rateLimitEnabled: boolean }): Router {
  const r = Router();
  r.post(
    '/seed',
    rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => !opts.rateLimitEnabled,
      handler: tooManyRequests,
    }),
    async (_req, res) => {
      res.json(await service.seed(authOf(res)));
    },
  );
  return r;
}
