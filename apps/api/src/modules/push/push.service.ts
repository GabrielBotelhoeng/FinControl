import type { PushConfigDTO, PushSubscriptionInput, PushTestDTO } from '@fincontrol/shared';
import { AppError } from '../../http/errors';
import type { Logger } from '../../infra/logger';
import type { PushPayload, PushSender } from '../../infra/push-sender';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PushRepository } from './push.repository';

export type PushServiceDeps = {
  repo: PushRepository;
  notifications: Pick<NotificationsService, 'list'>;
  /** `null` quando as chaves VAPID não estão configuradas (W1): push desligado. */
  sender: PushSender | null;
  publicKey: string | null;
  logger: Pick<Logger, 'error'>;
  clock: () => Date;
};

const TEST_PAYLOAD: PushPayload = {
  title: 'Os avisos do FinControl estão ligados',
  body: 'É assim que os avisos de contas, faturas, orçamento e metas vão chegar.',
  url: '/notificacoes',
  tag: 'fincontrol-teste',
};

export function createPushService(deps: PushServiceDeps) {
  const disabled = () => new AppError(503, 'Push indisponível', 'Os avisos no celular não estão configurados neste servidor.');

  /** Manda para todas as assinaturas da pessoa; apaga as expiradas (W3). */
  async function deliver(userId: string, payload: PushPayload): Promise<{ sent: number; removed: number }> {
    if (!deps.sender) throw disabled();
    const targets = await deps.repo.forUser(userId);
    let sent = 0;
    let removed = 0;
    for (const t of targets) {
      const result = await deps.sender(t, payload);
      if (result === 'sent') {
        sent += 1;
        await deps.repo.markSuccess(t.endpoint, deps.clock());
      } else if (result === 'gone') {
        removed += 1;
        await deps.repo.removeEndpoint(t.endpoint);
      }
    }
    return { sent, removed };
  }

  return {
    config(): PushConfigDTO {
      return { enabled: deps.sender !== null, publicKey: deps.sender ? deps.publicKey : null };
    },

    async subscribe(userId: string, input: PushSubscriptionInput): Promise<void> {
      if (!deps.sender) throw disabled();
      await deps.repo.upsert(userId, input);
    },

    unsubscribe(userId: string, endpoint: string): Promise<void> {
      return deps.repo.remove(userId, endpoint);
    },

    async test(userId: string): Promise<PushTestDTO> {
      return { sent: (await deliver(userId, TEST_PAYLOAD)).sent };
    },

    /**
     * W2 e W3 (cron diário): para cada pessoa com assinatura (sem demo), os avisos ativos não lidos que ainda não
     * foram por push viram uma mensagem só. Marca como enviados quando ao menos um aparelho recebeu.
     */
    async sendDaily(): Promise<{ users: number; sent: number; removed: number }> {
      if (!deps.sender) return { users: 0, sent: 0, removed: 0 };
      const users = await deps.repo.usersWithSubscriptions();
      let sent = 0;
      let removed = 0;
      for (const userId of users) {
        try {
          const { items } = await deps.notifications.list(userId);
          const unread = items.filter((i) => !i.read);
          const fresh = await deps.repo.unpushed(userId, unread.map((i) => i.key));
          const news = unread.filter((i) => fresh.has(i.key));
          const first = news[0];
          if (!first) continue;
          const more = news.length - 1;
          const result = await deliver(userId, {
            title: first.title,
            body: more > 0 ? `${first.body} · e mais ${more} ${more === 1 ? 'aviso' : 'avisos'}` : first.body,
            url: '/notificacoes',
            tag: 'fincontrol-diario',
          });
          sent += result.sent;
          removed += result.removed;
          if (result.sent > 0) await deps.repo.markPushed(userId, news.map((i) => i.key), deps.clock());
        } catch (err) {
          // Uma pessoa com erro não impede o envio para as outras.
          deps.logger.error({ err, userId }, 'Push diário: falha ao enviar para um usuário');
        }
      }
      return { users: users.length, sent, removed };
    },
  };
}

export type PushService = ReturnType<typeof createPushService>;
