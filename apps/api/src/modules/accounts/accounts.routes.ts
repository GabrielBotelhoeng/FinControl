import { createAccountSchema, idSchema, listAccountsQuerySchema, updateAccountSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { AccountsService } from './accounts.service';

export function accountsRouter(service: AccountsService): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    const { includeArchived } = parse(listAccountsQuerySchema, req.query);
    res.json(await service.list(userIdOf(res), includeArchived));
  });
  r.post('/', async (req, res) => {
    res.status(201).json(await service.create(userIdOf(res), parse(createAccountSchema, req.body)));
  });
  r.patch('/:id', async (req, res) => {
    res.json(await service.update(userIdOf(res), parse(idSchema, req.params.id), parse(updateAccountSchema, req.body)));
  });
  r.delete('/:id', async (req, res) => {
    await service.remove(userIdOf(res), parse(idSchema, req.params.id));
    res.status(204).end();
  });
  r.post('/:id/archive', async (req, res) => {
    res.json(await service.archive(userIdOf(res), parse(idSchema, req.params.id)));
  });
  r.post('/:id/unarchive', async (req, res) => {
    res.json(await service.unarchive(userIdOf(res), parse(idSchema, req.params.id)));
  });
  return r;
}
