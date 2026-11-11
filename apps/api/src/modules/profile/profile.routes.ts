import { updateProfileSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { authOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { ProfileService } from './profile.service';

export function profileRouter(service: ProfileService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await service.get(authOf(res)));
  });
  r.patch('/', async (req, res) => {
    res.json(await service.update(authOf(res), parse(updateProfileSchema, req.body)));
  });
  r.delete('/', async (_req, res) => {
    await service.deleteAccount(authOf(res).userId);
    res.status(204).end();
  });
  return r;
}
