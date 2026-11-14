import { idSchema, listInvoicesQuerySchema, payInvoiceSchema, yearMonthSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { CardsService } from './cards.service';

export function cardsRouter(service: CardsService): Router {
  const r = Router();
  r.get('/:id/invoices', async (req, res) => {
    const { from, to } = parse(listInvoicesQuerySchema, req.query);
    res.json(await service.listInvoices(userIdOf(res), parse(idSchema, req.params.id), from, to));
  });
  r.get('/:id/invoices/:month', async (req, res) => {
    const id = parse(idSchema, req.params.id);
    const month = parse(yearMonthSchema, req.params.month);
    res.json(await service.getInvoice(userIdOf(res), id, month));
  });
  r.post('/:id/invoices/:month/payments', async (req, res) => {
    const id = parse(idSchema, req.params.id);
    const month = parse(yearMonthSchema, req.params.month);
    const input = parse(payInvoiceSchema, req.body);
    res.status(201).json(await service.payInvoice(userIdOf(res), id, month, input));
  });
  return r;
}
