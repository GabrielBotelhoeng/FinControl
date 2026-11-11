import {
  createTransactionSchema, idSchema, listTransactionsQuerySchema, paySchema, scopeQuerySchema, updateTransactionSchema,
} from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { TransactionsService } from './transactions.service';

export function transactionsRouter(service: TransactionsService): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    res.json(await service.list(userIdOf(res), parse(listTransactionsQuerySchema, req.query)));
  });
  r.post('/', async (req, res) => {
    res.status(201).json(await service.create(userIdOf(res), parse(createTransactionSchema, req.body)));
  });
  r.patch('/:id', async (req, res) => {
    const { scope } = parse(scopeQuerySchema, req.query);
    res.json(await service.update(userIdOf(res), parse(idSchema, req.params.id), parse(updateTransactionSchema, req.body), scope));
  });
  r.delete('/:id', async (req, res) => {
    const { scope } = parse(scopeQuerySchema, req.query);
    await service.remove(userIdOf(res), parse(idSchema, req.params.id), scope);
    res.status(204).end();
  });
  r.post('/:id/pay', async (req, res) => {
    const { paidDate } = parse(paySchema, req.body ?? {});
    res.json(await service.pay(userIdOf(res), parse(idSchema, req.params.id), paidDate));
  });
  r.post('/:id/unpay', async (req, res) => {
    res.json(await service.unpay(userIdOf(res), parse(idSchema, req.params.id)));
  });
  return r;
}
