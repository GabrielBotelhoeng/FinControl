import { monthOf, todayInSaoPaulo, type GoalDTO, type GoalStatus } from '@fincontrol/shared';
import { AlertTriangle, CheckCircle2, CircleSlash, Plus, ShieldCheck, Target, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Panel } from '../../components/ui/panel';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/states';
import { cn } from '../../lib/cn';
import { formatBRL, formatMonthShort } from '../../lib/format';
import { useSummary } from '../dashboard/api';
import { useGoals } from './api';
import { GoalDialog } from './goal-dialog';
import { GoalForm, inMonths, type GoalDraft } from './goal-form';

/** Situação sempre com ícone e texto (P7). */
const GOAL_STATUS: Record<GoalStatus, { label: string; icon: LucideIcon; tone: string; bar: string }> = {
  reached: { label: 'Concluída', icon: CheckCircle2, tone: 'text-income', bar: 'bg-income' },
  on_track: { label: 'No ritmo', icon: CheckCircle2, tone: 'text-income', bar: 'bg-primary' },
  late: { label: 'Atrasada', icon: AlertTriangle, tone: 'text-warning', bar: 'bg-primary' },
  overdue: { label: 'Prazo vencido', icon: CircleSlash, tone: 'text-expense', bar: 'bg-expense' },
};

function GoalCard({ goal, onOpen }: { goal: GoalDTO; onOpen: () => void }) {
  const status = GOAL_STATUS[goal.status];
  const pct = Math.round(goal.fraction * 100);
  return (
    <Panel role="article" aria-label={goal.name} className="grid gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-display text-lg font-semibold tracking-tight">{goal.name}</p>
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-sm font-medium', status.tone)}>
          <status.icon aria-hidden className="h-4 w-4" strokeWidth={2} />
          {status.label}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Progresso de ${goal.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div className={cn('h-full rounded-full', status.bar)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span className="tabular">{`${formatBRL(goal.saved)} de ${formatBRL(goal.targetAmount)}`}</span>
        <span className="tabular text-muted">{pct}%</span>
      </div>
      {goal.monthlyNeeded > 0 && (
        <p className="text-sm text-muted">{`Guarde ${formatBRL(goal.monthlyNeeded)} por mês até ${formatMonthShort(monthOf(goal.targetDate))}.`}</p>
      )}
      <Button size="sm" variant="ghost" className="justify-self-start" onClick={onOpen}>
        Ver detalhes
      </Button>
    </Panel>
  );
}

export function GoalsTab() {
  const goals = useGoals();
  const summary = useSummary(monthOf(todayInSaoPaulo()));
  const [creating, setCreating] = useState<GoalDraft | null>(null);
  const [open, setOpen] = useState<GoalDTO | null>(null);

  const blank: GoalDraft = { name: '', targetAmount: null, targetDate: inMonths(12) };
  const average = summary.data?.health.averageMonthlyExpense ?? null;
  // P8: a reserva vem primeiro na ordem de prioridade (skill savings-goals). Alvo = 6 × o gasto médio do indicador.
  const reserve: GoalDraft = { name: 'Reserva de emergência', targetAmount: average ? average * 6 : null, targetDate: inMonths(12) };

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setCreating(blank)}>
        <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
        Nova meta
      </Button>
      <Button variant="secondary" disabled={summary.isPending} onClick={() => setCreating(reserve)}>
        <ShieldCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Meta de reserva de emergência
      </Button>
    </div>
  );

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6">
      {goals.isPending && <ListSkeleton />}
      {goals.isError && <ErrorState message={goals.error.message} onRetry={() => goals.refetch()} />}
      {goals.data && goals.data.length === 0 && (
        <EmptyState
          icon={<Target className="h-7 w-7" strokeWidth={1.5} />}
          title="Nenhuma meta ainda"
          description="Crie um objetivo, como uma viagem ou a reserva de emergência, e registre o que for guardando."
          action={actions}
        />
      )}
      {goals.data && goals.data.length > 0 && (
        <>
          {actions}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {goals.data.map((g) => (
              <GoalCard key={g.id} goal={g} onOpen={() => setOpen(g)} />
            ))}
          </div>
        </>
      )}
      <p className="text-xs text-muted">Sem rendimento: o cálculo considera só o que você guardar.</p>

      {creating && <GoalForm draft={creating} onOpenChange={(o) => !o && setCreating(null)} />}
      {open && <GoalDialog goalId={open.id} title={open.name} onOpenChange={(o) => !o && setOpen(null)} />}
    </div>
  );
}
