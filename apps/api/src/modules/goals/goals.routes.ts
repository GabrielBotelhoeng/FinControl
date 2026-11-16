import { contributionSchema, createGoalSchema, idSchema, updateGoalSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { GoalsService } from './goals.service';

export function goalsRouter(service: GoalsService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await service.list(userIdOf(res)));
  });
  r.post('/', async (req, res) => {
    res.status(201).json(await service.create(userIdOf(res), parse(createGoalSchema, req.body)));
  });
  r.get('/:id', async (req, res) => {
    res.json(await service.get(userIdOf(res), parse(idSchema, req.params.id)));
  });
  r.patch('/:id', async (req, res) => {
    res.json(await service.update(userIdOf(res), parse(idSchema, req.params.id), parse(updateGoalSchema, req.body)));
  });
  r.delete('/:id', async (req, res) => {
    await service.remove(userIdOf(res), parse(idSchema, req.params.id));
    res.status(204).end();
  });
  r.post('/:id/contributions', async (req, res) => {
    const contribution = await service.addContribution(userIdOf(res), parse(idSchema, req.params.id), parse(contributionSchema, req.body));
    res.status(201).json(contribution);
  });
  r.delete('/:id/contributions/:contributionId', async (req, res) => {
    await service.removeContribution(userIdOf(res), parse(idSchema, req.params.id), parse(idSchema, req.params.contributionId));
    res.status(204).end();
  });
  return r;
}
