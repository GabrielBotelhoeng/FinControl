import {
  addDays, daysLabel, dueSoon, formatBRL, goalReachedVisible, monthOf, notificationPrefs, sortNotifications, todayInSaoPaulo,
  type NotificationDTO, type NotificationListDTO,
} from '@fincontrol/shared';
import type { BudgetsService } from '../budgets/budgets.service';
import type { CardDebtDeps } from '../dashboard/dashboard.cards';
import { cardDebt } from '../dashboard/dashboard.cards';
import type { GoalsService } from '../goals/goals.service';
import type { ProfileRepository } from '../profile/profile.repository';
import type { RecurrencesService } from '../recurrences/recurrences.service';
import type { NotificationsRepository } from './notifications.repository';

const INACTIVE_DAYS = 60;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthShort = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(0, 4)}`;

export type NotificationsServiceDeps = {
  repo: NotificationsRepository;
  profileRepo: Pick<ProfileRepository, 'find'>;
  recurrences: Pick<RecurrencesService, 'materialize'>;
  cards: CardDebtDeps;
  budgets: Pick<BudgetsService, 'getMonth'>;
  goals: Pick<GoalsService, 'list'>;
  clock: () => Date;
};

type Candidate = Omit<NotificationDTO, 'read'>;

export function createNotificationsService(deps: NotificationsServiceDeps) {
  /** Os avisos ativos agora (N4), já filtrados pelas preferências (N7), sem a memória de lido. */
  async function candidates(userId: string, now: Date): Promise<{ list: Candidate[]; goalKeys: Set<string> }> {
    const today = todayInSaoPaulo(now);
    const current = monthOf(today);
    const profile = await deps.profileRepo.find(userId);
    const prefs = notificationPrefs(profile?.notificationPrefs);
    const until = addDays(today, prefs.billDays);
    if (prefs.bills) await deps.recurrences.materialize(userId, until);

    const [bills, debt, budget, goals] = await Promise.all([
      prefs.bills ? deps.repo.pendingBills(userId, until) : [],
      prefs.invoices ? cardDebt(deps.cards, userId, current) : null,
      prefs.budget ? deps.budgets.getMonth(userId, current) : null,
      prefs.goals ? deps.goals.list(userId) : [],
    ]);

    const list: Candidate[] = [];
    for (const b of bills) {
      const overdue = b.dueDate < today;
      if (!overdue && !dueSoon(b.dueDate, today, prefs.billDays)) continue;
      list.push({
        key: `${overdue ? 'overdue' : 'due'}:${b.id}:${b.dueDate}`,
        kind: overdue ? 'bill_overdue' : 'bill_due',
        priority: overdue ? 1 : 2,
        title: b.description,
        body: `${formatBRL(b.amount)} · ${daysLabel(b.dueDate, today)}`,
        href: '/lancamentos',
        action: 'Pagar',
        date: b.dueDate,
      });
    }
    for (const inv of debt?.items ?? []) {
      const overdue = inv.status === 'overdue';
      list.push({
        key: `invoice:${inv.cardId}:${inv.month}:${inv.status}`,
        kind: overdue ? 'invoice_overdue' : 'invoice_closed',
        priority: overdue ? 1 : 2,
        title: `Fatura ${inv.cardName} de ${monthShort(inv.month)}`,
        body: `${formatBRL(inv.remaining)} a pagar · ${daysLabel(inv.dueDate, today)}`,
        href: `/cartoes/${inv.cardId}`,
        action: 'Ver fatura',
        date: inv.dueDate,
      });
    }
    for (const item of budget?.items ?? []) {
      if (item.status === 'ok') continue;
      const over = item.status === 'over';
      list.push({
        key: `budget:${item.categoryId}:${budget!.month}:${item.status}`,
        kind: over ? 'budget_over' : 'budget_near',
        priority: over ? 2 : 3,
        title: over ? `${item.name} estourou o limite` : `${item.name} perto do limite`,
        body: `${formatBRL(item.committed)} de ${formatBRL(item.limit)} (${item.percent}%) em ${monthShort(budget!.month)}`,
        href: '/planejamento',
        action: 'Ver orçamento',
        date: `${budget!.month}-01`,
      });
    }
    const goalKeys = new Set<string>();
    for (const g of goals) {
      if (g.status !== 'reached') continue;
      const key = `goal:${g.id}:reached`;
      goalKeys.add(key);
      list.push({
        key,
        kind: 'goal_reached',
        priority: 4,
        title: `Meta concluída: ${g.name}`,
        body: `Você guardou ${formatBRL(g.saved)} de ${formatBRL(g.targetAmount)}.`,
        href: '/planejamento?aba=metas',
        action: 'Ver metas',
        date: today,
      });
    }
    return { list, goalKeys };
  }

  async function active(userId: string): Promise<NotificationListDTO> {
    const now = deps.clock();
    const { list, goalKeys } = await candidates(userId, now);
    const memory = await deps.repo.touch(userId, list.map((c) => c.key), now);
    const items = sortNotifications(
      list
        // N4 (e): a meta concluída some 30 dias depois da primeira vez.
        .filter((c) => !goalKeys.has(c.key) || goalReachedVisible(memory.get(c.key)?.firstSeenAt ?? null, now))
        .map((c) => {
          const m = memory.get(c.key);
          return { ...c, date: goalKeys.has(c.key) && m ? todayInSaoPaulo(m.firstSeenAt) : c.date, read: Boolean(m?.readAt) };
        }),
    );
    return { items, unreadCount: items.filter((i) => !i.read).length };
  }

  return {
    list: active,

    async markRead(userId: string, keys: string[]): Promise<NotificationListDTO> {
      await deps.repo.markRead(userId, keys, deps.clock());
      return active(userId);
    },

    async markAllRead(userId: string): Promise<NotificationListDTO> {
      const { items } = await active(userId);
      if (items.length > 0) await deps.repo.markRead(userId, items.map((i) => i.key), deps.clock());
      return active(userId);
    },

    /** N8: chamada pelo cron diário. */
    purge(): Promise<number> {
      return deps.repo.purgeInactive(deps.clock(), INACTIVE_DAYS);
    },
  };
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;
