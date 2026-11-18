import { assistantChatSchema } from '@fincontrol/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authOf, userIdOf } from '../../http/auth';
import { tooManyRequests } from '../../http/problem';
import { parse } from '../../http/validate';
import type { AssistantService } from './assistant.service';

export function assistantRouter(service: AssistantService, opts: { rateLimitEnabled: boolean }): Router {
  const r = Router();
  r.get('/config', async (_req, res) => {
    res.json(await service.config(authOf(res)));
  });
  r.post('/consent', async (_req, res) => {
    await service.consent(authOf(res));
    res.status(204).end();
  });
  r.delete('/consent', async (_req, res) => {
    await service.revokeConsent(userIdOf(res));
    res.status(204).end();
  });
  r.post(
    '/chat',
    // A9: 30 perguntas por hora por pessoa, contra loop ou conta roubada gastando os créditos.
    rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 30,
      keyGenerator: (_req, res) => userIdOf(res),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => !opts.rateLimitEnabled,
      handler: tooManyRequests,
    }),
    async (req, res) => {
      res.json(await service.chat(authOf(res), parse(assistantChatSchema, req.body).messages));
    },
  );
  return r;
}
