import type { OnboardingDTO } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import type { Db } from '../../infra/prisma';

/** Primeiros passos (sub-projeto 12, G2): cada passo está feito quando existe pelo menos um registro dele. */
export function createOnboardingService(deps: { db: Db }) {
  const exists = async (query: Promise<{ id: string } | null>) => (await query) !== null;
  return {
    async get(userId: string): Promise<OnboardingDTO> {
      const first = { where: { userId }, select: { id: true } };
      const [account, transaction, budget, goal] = await Promise.all([
        exists(deps.db.account.findFirst(first)),
        exists(deps.db.transaction.findFirst(first)),
        exists(deps.db.budget.findFirst(first)),
        exists(deps.db.goal.findFirst(first)),
      ]);
      return { account, transaction, budget, goal };
    },
  };
}

export type OnboardingService = ReturnType<typeof createOnboardingService>;

export function onboardingRouter(service: OnboardingService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await service.get(userIdOf(res)));
  });
  return r;
}
