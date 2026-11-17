import { reportQuerySchema } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { ReportsService } from './reports.service';

export function reportsRouter(service: ReportsService): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    const { from, to } = parse(reportQuerySchema, req.query);
    res.json(await service.build(userIdOf(res), from, to));
  });
  return r;
}
