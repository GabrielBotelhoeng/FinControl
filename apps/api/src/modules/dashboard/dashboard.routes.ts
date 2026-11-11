import { byCategoryQuerySchema, evolutionQuerySchema, summaryQuerySchema } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { DashboardService } from './dashboard.service';

export function dashboardRouter(service: DashboardService): Router {
  const r = Router();
  r.get('/summary', async (req, res) => {
    const { month } = parse(summaryQuerySchema, req.query);
    res.json(await service.summary(userIdOf(res), month));
  });
  r.get('/evolution', async (req, res) => {
    const { months } = parse(evolutionQuerySchema, req.query);
    res.json(await service.evolution(userIdOf(res), months));
  });
  r.get('/by-category', async (req, res) => {
    const { month } = parse(byCategoryQuerySchema, req.query);
    res.json(await service.byCategory(userIdOf(res), month));
  });
  return r;
}
