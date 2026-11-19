import {
  daysInMonth, monthOf, todayInSaoPaulo, type CalendarDTO, type CalendarItemDTO, type YearMonth,
} from '@fincontrol/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, CircleAlert, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { MonthPicker } from '../../components/ui/month-picker';
import { PageHeader } from '../../components/ui/page-header';
import { Panel } from '../../components/ui/panel';
import { ErrorState, ListSkeleton } from '../../components/ui/states';
import { useApi } from '../../lib/api-context';
import { cn } from '../../lib/cn';
import { formatBRL, formatDate } from '../../lib/format';
import { usePayToggle } from '../transactions/api';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function useCalendar(month: YearMonth) {
  const api = useApi();
  return useQuery({ queryKey: ['calendar', month], queryFn: () => api.get<CalendarDTO>('/calendar', { month }) });
}

/** Situação do dia para o ponto colorido (K4): vencida > a pagar > tudo pago. */
function dayTone(items: CalendarItemDTO[]): 'overdue' | 'pending' | 'done' | null {
  if (items.length === 0) return null;
  const outgoing = items.filter((i) => i.kind === 'invoice' || i.type === 'expense');
  if (outgoing.some((i) => (i.kind === 'invoice' ? i.status === 'overdue' && i.remaining > 0 : i.overdue))) return 'overdue';
  if (outgoing.some((i) => (i.kind === 'invoice' ? i.remaining > 0 : i.status === 'pending'))) return 'pending';
  return 'done';
}

const TONE = { overdue: 'bg-expense', pending: 'bg-primary', done: 'bg-income' } as const;
const TONE_LABEL = { overdue: 'conta vencida', pending: 'contas a pagar', done: 'tudo pago' } as const;

function ItemRow({ item }: { item: CalendarItemDTO }) {
  const pay = usePayToggle();
  if (item.kind === 'invoice') {
    const paid = item.remaining === 0;
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 py-3">
        <span className="flex min-w-0 items-center gap-3">
          <CreditCard aria-hidden className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.75} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{`Fatura ${item.cardName}`}</span>
            <span className={cn('text-xs', item.status === 'overdue' && !paid ? 'text-expense' : 'text-muted')}>
              {paid ? 'Paga' : item.status === 'overdue' ? 'Vencida' : item.status === 'open' ? 'Aberta' : 'Fechada'}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="tabular text-sm font-semibold">{formatBRL(paid ? item.amount : item.remaining)}</span>
          <Link to={`/cartoes/${item.cardId}`} className="text-sm font-medium text-primary hover:underline">
            Ver fatura
          </Link>
        </span>
      </li>
    );
  }
  const income = item.type === 'income';
  const { id, status } = item;
  async function toggle() {
    try {
      await pay.mutateAsync({ id, paid: status === 'pending' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar.');
    }
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{item.description}</span>
        <span className={cn('text-xs', item.overdue ? 'text-expense' : 'text-muted')}>
          {[item.category, item.status === 'paid' ? (income ? 'Recebido' : 'Pago') : item.overdue ? 'Vencido' : income ? 'A receber' : 'A pagar']
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className="flex items-center gap-3">
        <span className={cn('tabular text-sm font-semibold', income && 'text-income')}>{`${income ? '+' : ''}${formatBRL(item.amount)}`}</span>
        {item.status === 'pending' && (
          <Button size="sm" variant="secondary" loading={pay.isPending} onClick={toggle}>
            {income ? 'Recebi' : 'Pagar'}
          </Button>
        )}
      </span>
    </li>
  );
}

export default function CalendarPage() {
  const today = todayInSaoPaulo();
  const [month, setMonth] = useState<YearMonth>(monthOf(today));
  const [picked, setPicked] = useState<string | null>(null);
  const calendar = useCalendar(month);
  const data = calendar.data;

  const [y, m] = month.split('-').map(Number) as [number, number];
  const total = daysInMonth(y, m);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const dates = Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const itemsOf = (date: string) => data?.days.find((d) => d.date === date)?.items ?? [];
  const selected = picked && picked.startsWith(month) ? picked : monthOf(today) === month ? today : (data?.days[0]?.date ?? `${month}-01`);
  const selectedItems = itemsOf(selected);

  return (
    <>
      <PageHeader
        light="Calendário de"
        bold="contas"
        description="O que vence em cada dia do mês: contas, receitas e faturas do cartão."
        actions={
          <MonthPicker
            value={month}
            onChange={(v) => {
              setMonth(v);
              setPicked(null);
            }}
          />
        }
      />

      {calendar.isPending && <ListSkeleton />}
      {calendar.isError && <ErrorState message={calendar.error.message} onRetry={() => calendar.refetch()} />}

      {data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="grid grid-cols-1 content-start gap-6">
            <Panel role="group" aria-label="Totais do mês" className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
              {(
                [
                  ['A pagar', data.totals.toPay, 'text-text'],
                  ['Pago', data.totals.paid, 'text-text'],
                  ['A receber', data.totals.toReceive, 'text-income'],
                  ['Recebido', data.totals.received, 'text-income'],
                ] as const
              ).map(([label, value, tone]) => (
                <div key={label} className="grid min-w-0 gap-1">
                  <span className="text-xs text-muted">{label}</span>
                  <span className={cn('tabular truncate font-display text-lg font-semibold', tone)}>{formatBRL(value)}</span>
                </div>
              ))}
            </Panel>

            <Panel className="p-3 sm:p-5">
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted" aria-hidden>
                {WEEKDAYS.map((w) => (
                  <span key={w} className="py-1">
                    {w}
                  </span>
                ))}
              </div>
              <div role="grid" aria-label="Dias do mês" className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstWeekday }, (_, i) => (
                  <span key={`vazio-${i}`} aria-hidden />
                ))}
                {dates.map((date) => {
                  const items = itemsOf(date);
                  const tone = dayTone(items);
                  const day = Number(date.slice(8));
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setPicked(date)}
                      aria-pressed={selected === date}
                      aria-label={`${formatDate(date)}${tone ? `, ${items.length} ${items.length === 1 ? 'item' : 'itens'}, ${TONE_LABEL[tone]}` : ', nada vence'}`}
                      className={cn(
                        'flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] text-sm transition-colors',
                        selected === date ? 'bg-primary-soft font-semibold text-primary' : 'hover:bg-surface-2',
                        date === today && selected !== date && 'ring-1 ring-border',
                      )}
                    >
                      <span className="tabular">{day}</span>
                      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', tone ? TONE[tone] : 'bg-transparent')} />
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-expense" />Vencida</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" />A pagar</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-income" />Tudo pago</span>
              </div>
            </Panel>
          </div>

          <Panel role="region" aria-label={`Contas de ${formatDate(selected)}`} className="grid content-start gap-2 p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">{formatDate(selected)}</h2>
            {selectedItems.length === 0 ? (
              <p className="inline-flex items-center gap-2 py-3 text-sm text-muted">
                <CalendarDays aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Nada vence neste dia.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {selectedItems.map((item) => (
                  <ItemRow key={item.kind === 'invoice' ? `fatura-${item.cardId}-${item.month}` : item.id} item={item} />
                ))}
              </ul>
            )}
            {data.days.some((d) => dayTone(d.items) === 'overdue') && (
              <p className="inline-flex items-center gap-2 pt-2 text-sm font-medium text-expense">
                <CircleAlert aria-hidden className="h-4 w-4" strokeWidth={2} />
                Há contas vencidas neste mês.
              </p>
            )}
            {data.days.length > 0 && data.totals.toPay === 0 && (
              <p className="inline-flex items-center gap-2 pt-2 text-sm font-medium text-income">
                <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
                Tudo pago neste mês.
              </p>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
