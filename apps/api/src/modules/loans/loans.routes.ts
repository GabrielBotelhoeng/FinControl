import { createLoanSchema, idSchema, updateLoanSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { LoansService } from './loans.service';

export function loansRouter(service: LoansService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await service.list(userIdOf(res)));
  });
  r.post('/', async (req, res) => {
    res.status(201).json(await service.create(userIdOf(res), parse(createLoanSchema, req.body)));
  });
  r.get('/:id', async (req, res) => {
    res.json(await service.get(userIdOf(res), parse(idSchema, req.params.id)));
  });
  r.patch('/:id', async (req, res) => {
    const { name } = parse(updateLoanSchema, req.body);
    res.json(await service.rename(userIdOf(res), parse(idSchema, req.params.id), name));
  });
  r.delete('/:id', async (req, res) => {
    await service.remove(userIdOf(res), parse(idSchema, req.params.id));
    res.status(204).end();
  });
  return r;
}
