import type { PushSubscriptionInput } from '@fincontrol/shared';
import type { Db } from '../../infra/prisma';
import type { PushTarget } from '../../infra/push-sender';

export function createPushRepository(db: Db) {
  return {
    /** W6: o endereço é único; se já existia (outra pessoa no mesmo navegador), passa para quem ativou agora. */
    async upsert(userId: string, input: PushSubscriptionInput): Promise<void> {
      const data = { userId, p256dh: input.keys.p256dh, auth: input.keys.auth };
      await db.pushSubscription.upsert({ where: { endpoint: input.endpoint }, create: { ...data, endpoint: input.endpoint }, update: data });
    },

    async remove(userId: string, endpoint: string): Promise<void> {
      await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
    },

    async forUser(userId: string): Promise<PushTarget[]> {
      return db.pushSubscription.findMany({ where: { userId }, select: { endpoint: true, p256dh: true, auth: true } });
    },

    /** W3: quem tem assinatura e não é demo. */
    async usersWithSubscriptions(): Promise<string[]> {
      const rows = await db.pushSubscription.findMany({ where: { user: { isDemo: false } }, select: { userId: true }, distinct: ['userId'] });
      return rows.map((r) => r.userId);
    },

    async markSuccess(endpoint: string, at: Date): Promise<void> {
      await db.pushSubscription.updateMany({ where: { endpoint }, data: { lastSuccessAt: at } });
    },

    async removeEndpoint(endpoint: string): Promise<void> {
      await db.pushSubscription.deleteMany({ where: { endpoint } });
    },

    /** W2: dos avisos dados, os que ainda não foram por push. */
    async unpushed(userId: string, keys: string[]): Promise<Set<string>> {
      if (keys.length === 0) return new Set();
      const rows = await db.notification.findMany({ where: { userId, key: { in: keys }, pushedAt: null }, select: { key: true } });
      return new Set(rows.map((r) => r.key));
    },

    async markPushed(userId: string, keys: string[], at: Date): Promise<void> {
      await db.notification.updateMany({ where: { userId, key: { in: keys } }, data: { pushedAt: at } });
    },
  };
}

export type PushRepository = ReturnType<typeof createPushRepository>;
