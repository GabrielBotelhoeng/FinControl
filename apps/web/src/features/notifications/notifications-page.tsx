import type { NotificationDTO, NotificationKind } from '@fincontrol/shared';
import { AlertTriangle, CalendarClock, CheckCheck, CircleAlert, CircleSlash, CreditCard, PartyPopper, Trophy, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { useMarkAllRead, useMarkRead, useNotifications } from './api';

/** Tipo sempre com ícone e texto, nunca só cor. */
const KIND: Record<NotificationKind, { label: string; icon: LucideIcon; tone: string }> = {
  bill_overdue: { label: 'Conta vencida', icon: CircleAlert, tone: 'text-expense' },
  invoice_overdue: { label: 'Fatura vencida', icon: CreditCard, tone: 'text-expense' },
  budget_over: { label: 'Orçamento estourado', icon: CircleSlash, tone: 'text-expense' },
  bill_due: { label: 'Vence em breve', icon: CalendarClock, tone: 'text-warning' },
  invoice_closed: { label: 'Fatura fechada', icon: CreditCard, tone: 'text-warning' },
  budget_near: { label: 'Perto do limite', icon: AlertTriangle, tone: 'text-warning' },
  goal_reached: { label: 'Meta concluída', icon: Trophy, tone: 'text-income' },
};

function NotificationItem({ item, onAct }: { item: NotificationDTO; onAct: () => void }) {
  const kind = KIND[item.kind];
  return (
    <li aria-label={item.title} className={cn('flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:flex-nowrap', !item.read && 'bg-primary-soft/40')}>
      <kind.icon aria-hidden className={cn('h-5 w-5 shrink-0', kind.tone)} strokeWidth={1.75} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className={cn('text-xs font-medium', kind.tone)}>
          {kind.label}
          {!item.read && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" aria-hidden />}
          {!item.read && <span className="sr-only"> · não lida</span>}
        </span>
        <span className={cn('truncate text-sm', !item.read && 'font-semibold')}>{item.title}</span>
        <span className="tabular text-xs text-muted">{item.body}</span>
      </div>
      <Link
        to={item.href}
        onClick={onAct}
        className="inline-flex h-9 shrink-0 items-center rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-surface-2"
      >
        {item.action}
      </Link>
    </li>
  );
}

/** Central de notificações (sub-projeto 5): o que precisa de atenção agora, do mais urgente ao menos (N5). */
export default function NotificationsPage() {
  const notifications = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const data = notifications.data;

  return (
    <>
      <PageHeader
        light="Suas"
        bold="notificações"
        description="Contas a vencer, faturas, orçamento e metas. Os avisos somem sozinhos quando o assunto se resolve."
        actions={
          data && data.unreadCount > 0 ? (
            <Button variant="secondary" loading={markAll.isPending} onClick={() => markAll.mutate()}>
              <CheckCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Marcar todas como lidas
            </Button>
          ) : undefined
        }
      />
      {notifications.isPending && <ListSkeleton rows={4} />}
      {notifications.isError && <ErrorState message={notifications.error.message} onRetry={() => notifications.refetch()} />}
      {data && data.items.length === 0 && (
        <Panel className="px-6">
          <EmptyState
            icon={<PartyPopper aria-hidden className="h-6 w-6" strokeWidth={1.75} />}
            title="Tudo em dia"
            description="Nenhuma conta para vencer nos próximos dias, nenhuma fatura em aberto e o orçamento sob controle."
            action={
              <Link to="/perfil" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                Ajustar notificações
              </Link>
            }
          />
        </Panel>
      )}
      {data && data.items.length > 0 && (
        <Panel className="overflow-hidden">
          <ul aria-label="Notificações" className="divide-y divide-border">
            {data.items.map((item) => (
              <NotificationItem key={item.key} item={item} onAct={() => !item.read && markRead.mutate([item.key])} />
            ))}
          </ul>
        </Panel>
      )}
      <p className="mt-4 text-xs text-muted">
        <Link to="/perfil" className="underline-offset-4 hover:underline">
          Escolha no Perfil
        </Link>{' '}
        quais avisos receber e com quantos dias de antecedência.
      </p>
    </>
  );
}
