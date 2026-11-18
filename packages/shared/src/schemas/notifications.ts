import { z } from 'zod';
import type { NotificationPrefs } from '../notifications';

// ---------- Notificações (spec do sub-projeto 5) ----------

/** N7: o objeto inteiro, como a tela de Perfil envia. */
export const notificationPrefsSchema = z.object({
  bills: z.boolean(),
  invoices: z.boolean(),
  budget: z.boolean(),
  goals: z.boolean(),
  billDays: z.union([z.literal(1), z.literal(3), z.literal(7)], 'Escolha 1, 3 ou 7 dias'),
}) satisfies z.ZodType<NotificationPrefs>;

export const markReadSchema = z.object({
  keys: z.array(z.string().min(1).max(200)).min(1, 'Informe ao menos um aviso').max(100, 'No máximo 100 avisos por vez'),
});

export type NotificationKind = 'bill_due' | 'bill_overdue' | 'invoice_closed' | 'invoice_overdue' | 'budget_near' | 'budget_over' | 'goal_reached';

/** Ação do aviso: o texto do botão e para onde ele leva. */
export type NotificationDTO = {
  key: string;
  kind: NotificationKind;
  /** N5: 1 = mais urgente. */
  priority: number;
  title: string;
  body: string;
  href: string;
  action: string;
  /** Data de referência (vencimento, mês ou dia em que a meta foi concluída). */
  date: string;
  read: boolean;
};

export type NotificationListDTO = { items: NotificationDTO[]; unreadCount: number };

// ---------- Web Push (spec do sub-projeto 5, Parte B) ----------

/**
 * W5: só serviços de push conhecidos. A API faz POST nesse endereço, então qualquer outro (inclusive endereços
 * internos) é recusado.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export function isKnownPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && url.port === '' && PUSH_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(1000, 'Endereço longo demais').refine(isKnownPushEndpoint, 'Serviço de push não reconhecido'),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export const pushEndpointSchema = z.object({ endpoint: z.string().min(1).max(1000) });

export type PushSubscriptionInput = z.output<typeof pushSubscriptionSchema>;
export type PushConfigDTO = { enabled: boolean; publicKey: string | null };
export type PushTestDTO = { sent: number };
