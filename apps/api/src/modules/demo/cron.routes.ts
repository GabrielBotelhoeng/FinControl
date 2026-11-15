import { timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { UnauthorizedError } from '../../http/errors';
import type { BankRatesService } from '../bank-rates/bank-rates.service';
import type { DemoService } from './demo.service';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Rotas internas chamadas pelo Vercel Cron (GET), com o segredo no header Authorization. */
export function cronRouter(deps: { secret: string; demo: DemoService; bankRates: BankRatesService }): Router {
  const r = Router();
  const guarded =
    (run: () => Promise<unknown>): RequestHandler =>
    async (req, res) => {
      if (!safeEqual(req.headers.authorization ?? '', `Bearer ${deps.secret}`)) throw new UnauthorizedError();
      res.json(await run());
    };
  const cleanup = guarded(() => deps.demo.cleanup());
  r.get('/cleanup-demo', cleanup);
  r.post('/cleanup-demo', cleanup);
  // Semanal (D4): as taxas de pessoa física saem por semana.
  const syncBankRates = guarded(() => deps.bankRates.sync());
  r.get('/sync-bank-rates', syncBankRates);
  r.post('/sync-bank-rates', syncBankRates);
  return r;
}
