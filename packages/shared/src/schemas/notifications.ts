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
