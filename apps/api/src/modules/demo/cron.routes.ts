import { timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { UnauthorizedError } from '../../http/errors';
import type { BankRatesService } from '../bank-rates/bank-rates.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PushService } from '../push/push.service';
import type { DemoService } from './demo.service';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Rotas internas chamadas pelo Vercel Cron (GET), com o segredo no header Authorization. */
export function cronRouter(deps: { secret: string; demo: DemoService; bankRates: BankRatesService; notifications: Pick<NotificationsService, 'purge'>; push: Pick<PushService, 'sendDaily'> }): Router {
  const r = Router();
  const guarded =
    (run: () => Promise<unknown>): RequestHandler =>
    async (req, res) => {
      if (!safeEqual(req.headers.authorization ?? '', `Bearer ${deps.secret}`)) throw new UnauthorizedError();
      res.json(await run());
    };
  // Diário: demos com mais de 7 dias e a memória de avisos inativos há mais de 60 dias (sub-projeto 5, N8).
  const cleanup = guarded(async () => ({ ...(await deps.demo.cleanup()), notificationsPurged: await deps.notifications.purge() }));
  r.get('/cleanup-demo', cleanup);
  r.post('/cleanup-demo', cleanup);
  // Semanal (D4): as taxas de pessoa física saem por semana.
  const syncBankRates = guarded(() => deps.bankRates.sync());
  r.get('/sync-bank-rates', syncBankRates);
  r.post('/sync-bank-rates', syncBankRates);
  // Diário às 08:00 de Brasília (sub-projeto 5, Parte B, W3).
  const sendPush = guarded(() => deps.push.sendDaily());
  r.get('/send-push', sendPush);
  r.post('/send-push', sendPush);
  return r;
}
