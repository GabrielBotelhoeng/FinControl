import { timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { UnauthorizedError } from '../../http/errors';
import type { DemoService } from './demo.service';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Rotas internas chamadas pelo Vercel Cron (GET), com o segredo no header Authorization. */
export function cronRouter(deps: { secret: string; demo: DemoService }): Router {
  const r = Router();
  const cleanup: RequestHandler = async (req, res) => {
    if (!safeEqual(req.headers.authorization ?? '', `Bearer ${deps.secret}`)) throw new UnauthorizedError();
    res.json(await deps.demo.cleanup());
  };
  r.get('/cleanup-demo', cleanup);
  r.post('/cleanup-demo', cleanup);
  return r;
}
