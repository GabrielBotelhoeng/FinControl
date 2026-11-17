import { budgetQuerySchema, forecastQuerySchema, idSchema, setBudgetSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { BudgetsService } from './budgets.service';

export function budgetsRouter(service: BudgetsService): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    res.json(await service.getMonth(userIdOf(res), parse(budgetQuerySchema, req.query).month));
  });
  r.put('/:categoryId', async (req, res) => {
    const { limit } = parse(setBudgetSchema, req.body);
    const categoryId = await service.set(userIdOf(res), parse(idSchema, req.params.categoryId), limit);
    res.status(200).json({ categoryId, limit });
  });
  r.delete('/:categoryId', async (req, res) => {
    await service.remove(userIdOf(res), parse(idSchema, req.params.categoryId));
    res.status(204).end();
  });
  return r;
}

export function planningRouter(service: BudgetsService): Router {
  const r = Router();
  r.get('/forecast', async (req, res) => {
    res.json(await service.forecast(userIdOf(res), parse(forecastQuerySchema, req.query).months));
  });
  return r;
}
