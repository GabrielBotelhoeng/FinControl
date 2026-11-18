import { pushEndpointSchema, pushSubscriptionSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { PushService } from './push.service';

export function pushRouter(service: PushService): Router {
  const r = Router();
  r.get('/config', (_req, res) => {
    res.json(service.config());
  });
  r.post('/subscriptions', async (req, res) => {
    await service.subscribe(userIdOf(res), parse(pushSubscriptionSchema, req.body));
    res.status(204).end();
  });
  r.delete('/subscriptions', async (req, res) => {
    await service.unsubscribe(userIdOf(res), parse(pushEndpointSchema, req.body).endpoint);
    res.status(204).end();
  });
  r.post('/test', async (_req, res) => {
    res.json(await service.test(userIdOf(res)));
  });
  return r;
}
