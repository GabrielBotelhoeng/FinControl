/**
 * Regras das notificações (spec do sub-projeto 5, seção 4). Datas `YYYY-MM-DD`.
 */
import { addDays, type DateOnly } from './dates';

export const BILL_DAY_OPTIONS = [1, 3, 7] as const;
export type BillDays = (typeof BILL_DAY_OPTIONS)[number];

export type NotificationPrefs = { bills: boolean; invoices: boolean; budget: boolean; goals: boolean; billDays: BillDays };

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { bills: true, invoices: true, budget: true, goals: true, billDays: 3 };

/** N7: completa os padrões a partir do JSON gravado, ignorando o que não for válido. */
export function notificationPrefs(raw: unknown): NotificationPrefs {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const flag = (k: 'bills' | 'invoices' | 'budget' | 'goals') => (typeof o[k] === 'boolean' ? (o[k] as boolean) : DEFAULT_NOTIFICATION_PREFS[k]);
  const days = BILL_DAY_OPTIONS.find((d) => d === o.billDays) ?? DEFAULT_NOTIFICATION_PREFS.billDays;
  return { bills: flag('bills'), invoices: flag('invoices'), budget: flag('budget'), goals: flag('goals'), billDays: days };
}

/** N4 (a): vence de hoje até hoje + `days`, contando os dois. */
export function dueSoon(dueDate: DateOnly, today: DateOnly, days: number): boolean {
  return dueDate >= today && dueDate <= addDays(today, days);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const diffDays = (a: DateOnly, b: DateOnly) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS);

export function daysLabel(dueDate: DateOnly, today: DateOnly): string {
  const d = diffDays(dueDate, today);
  if (d === 0) return 'vence hoje';
  if (d === 1) return 'vence amanhã';
  if (d > 1) return `vence em ${d} dias`;
  if (d === -1) return 'venceu ontem';
  return `venceu há ${-d} dias`;
}

/** N5: prioridade (1 = mais urgente) e, empatado, a data mais antiga primeiro. */
export function sortNotifications<T extends { priority: number; date: string; key: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.priority - b.priority || a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

const GOAL_VISIBLE_MS = 30 * DAY_MS;

/** N4 (e): a meta concluída aparece por 30 dias a partir da primeira vez (`null` = ainda não apareceu). */
export function goalReachedVisible(firstSeenAt: Date | null, now: Date): boolean {
  return firstSeenAt === null || now.getTime() - firstSeenAt.getTime() <= GOAL_VISIBLE_MS;
}
