import type { PushSubscriptionInput } from '@fincontrol/shared';
import type { Db } from '../../infra/prisma';
import type { PushTarget } from '../../infra/push-sender';

const MAX_PER_USER = 10;

export function createPushRepository(db: Db) {
  return {
    /** W6: o endereço é único; se já existia (outra pessoa no mesmo navegador), passa para quem ativou agora. */
    async upsert(userId: string, input: PushSubscriptionInput): Promise<void> {
      const data = { userId, p256dh: input.keys.p256dh, auth: input.keys.auth };
      await db.pushSubscription.upsert({ where: { endpoint: input.endpoint }, create: { ...data, endpoint: input.endpoint }, update: data });
      // No máximo MAX_PER_USER aparelhos: o mais antigo sai. Sem limite, endereços falsos atrasariam o envio diário.
      const extra = await db.pushSubscription.findMany({
        where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: MAX_PER_USER, select: { id: true },
      });
      if (extra.length > 0) await db.pushSubscription.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
    },

    async remove(userId: string, endpoint: string): Promise<void> {
      await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
    },

    async forUser(userId: string): Promise<(PushTarget & { createdAt: Date; lastSuccessAt: Date | null })[]> {
      return db.pushSubscription.findMany({
        where: { userId }, select: { endpoint: true, p256dh: true, auth: true, createdAt: true, lastSuccessAt: true },
      });
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

    /**
     * W2: reserva, de forma atômica, os avisos que ainda não foram por push (marca `pushedAt` e devolve as chaves).
     * Duas execuções do cron ao mesmo tempo nunca mandam o mesmo aviso duas vezes.
     */
    async reserve(userId: string, keys: string[], at: Date): Promise<Set<string>> {
      if (keys.length === 0) return new Set();
      const rows = await db.notification.updateManyAndReturn({
        // `readAt: null` de novo aqui: a pessoa pode ter lido entre o cálculo da lista e a reserva.
        where: { userId, key: { in: keys }, pushedAt: null, readAt: null }, data: { pushedAt: at }, select: { key: true },
      });
      return new Set(rows.map((r) => r.key));
    },

    /** Nenhum aparelho recebeu: os avisos voltam a esperar o próximo envio. */
    async release(userId: string, keys: string[], at: Date): Promise<void> {
      await db.notification.updateMany({ where: { userId, key: { in: keys }, pushedAt: at }, data: { pushedAt: null } });
    },
  };
}

export type PushRepository = ReturnType<typeof createPushRepository>;
