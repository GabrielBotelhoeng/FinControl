import { importCommitSchema, importPreviewSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userIdOf } from '../../http/auth';
import { tooManyRequests } from '../../http/problem';
import { parse } from '../../http/validate';
import type { ImportsService } from './imports.service';

export function importsRouter(service: ImportsService, opts: { rateLimitEnabled: boolean }): Router {
  const r = Router();
  // Cada pedido mexe com até 1.000 linhas: 30 por hora por pessoa bastam para importar e corrigir (revisão final).
  r.use(
    rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 30,
      keyGenerator: (_req, res) => userIdOf(res),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => !opts.rateLimitEnabled,
      handler: tooManyRequests,
    }),
  );
  r.post('/preview', async (req, res) => {
    res.json(await service.preview(userIdOf(res), parse(importPreviewSchema, req.body)));
  });
  r.post('/commit', async (req, res) => {
    res.status(201).json(await service.commit(userIdOf(res), parse(importCommitSchema, req.body)));
  });
  return r;
}
