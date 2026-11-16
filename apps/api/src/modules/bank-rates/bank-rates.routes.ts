import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../../http/validate';
import type { BankRatesService } from './bank-rates.service';

const searchQuerySchema = z.object({ q: z.string().max(80).default('') });

/** Instituições da última sincronização, para o seletor de banco do empréstimo. */
export function banksRouter(service: BankRatesService): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    res.json(await service.searchBanks(parse(searchQuerySchema, req.query).q));
  });
  return r;
}
