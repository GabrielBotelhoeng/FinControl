import {
  createDebtSchema, debtAgreementSchema, debtNoteSchema, debtPaymentSchema, debtValuationSchema, idSchema, updateDebtSchema,
} from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { DebtsService } from './debts.service';

export function debtsRouter(service: DebtsService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await service.list(userIdOf(res)));
  });
  r.post('/', async (req, res) => {
    res.status(201).json(await service.create(userIdOf(res), parse(createDebtSchema, req.body)));
  });
  r.get('/:id', async (req, res) => {
    res.json(await service.get(userIdOf(res), parse(idSchema, req.params.id)));
  });
  r.patch('/:id', async (req, res) => {
    res.json(await service.update(userIdOf(res), parse(idSchema, req.params.id), parse(updateDebtSchema, req.body)));
  });
  r.delete('/:id', async (req, res) => {
    await service.remove(userIdOf(res), parse(idSchema, req.params.id));
    res.status(204).end();
  });
  r.post('/:id/valuations', async (req, res) => {
    res.status(201).json(await service.addValuation(userIdOf(res), parse(idSchema, req.params.id), parse(debtValuationSchema, req.body)));
  });
  r.post('/:id/notes', async (req, res) => {
    res.status(201).json(await service.addNote(userIdOf(res), parse(idSchema, req.params.id), parse(debtNoteSchema, req.body)));
  });
  r.post('/:id/agreement', async (req, res) => {
    res.status(201).json(await service.createAgreement(userIdOf(res), parse(idSchema, req.params.id), parse(debtAgreementSchema, req.body)));
  });
  r.delete('/:id/agreement', async (req, res) => {
    res.json(await service.cancelAgreement(userIdOf(res), parse(idSchema, req.params.id)));
  });
  r.post('/:id/payments', async (req, res) => {
    res.status(201).json(await service.addPayment(userIdOf(res), parse(idSchema, req.params.id), parse(debtPaymentSchema, req.body)));
  });
  return r;
}
