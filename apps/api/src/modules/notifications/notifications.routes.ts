import { markReadSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { NotificationsService } from './notifications.service';

export function notificationsRouter(service: NotificationsService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await service.list(userIdOf(res)));
  });
  r.post('/read', async (req, res) => {
    res.json(await service.markRead(userIdOf(res), parse(markReadSchema, req.body).keys));
  });
  r.post('/read-all', async (_req, res) => {
    res.json(await service.markAllRead(userIdOf(res)));
  });
  return r;
}
