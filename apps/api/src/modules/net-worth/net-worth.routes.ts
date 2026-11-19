import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import type { NetWorthService } from './net-worth.service';

export function netWorthRouter(service: NetWorthService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await service.get(userIdOf(res)));
  });
  return r;
}
