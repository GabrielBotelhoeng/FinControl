import { importCommitSchema, importPreviewSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { ImportsService } from './imports.service';

export function importsRouter(service: ImportsService): Router {
  const r = Router();
  r.post('/preview', async (req, res) => {
    res.json(await service.preview(userIdOf(res), parse(importPreviewSchema, req.body)));
  });
  r.post('/commit', async (req, res) => {
    res.status(201).json(await service.commit(userIdOf(res), parse(importCommitSchema, req.body)));
  });
  return r;
}
