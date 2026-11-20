import { todayInSaoPaulo } from '@fincontrol/shared';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { ErrorState, ListSkeleton } from '../../components/ui/states';
import { ApiError } from '../../lib/api-client';
import { cn } from '../../lib/cn';
import { formatBRL, formatDate } from '../../lib/format';
import { useAddContribution, useDeleteContribution, useDeleteGoal, useGoal } from './api';
import { GoalForm } from './goal-form';

/** Detalhe da meta: depósitos e retiradas (P6), editar e excluir. */
export function GoalDialog({ goalId, title, onOpenChange }: { goalId: string; title: string; onOpenChange: (open: boolean) => void }) {
  const goal = useGoal(goalId);
  const add = useAddContribution();
  const removeContribution = useDeleteContribution();
  const removeGoal = useDeleteGoal();
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(todayInSaoPaulo());
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);

  async function register(sign: 1 | -1) {
    if (!amount) return setError('Informe o valor.');
    setError(null);
    try {
      await add.mutateAsync({ goalId, amount: sign * amount, date });
      toast.success(sign > 0 ? 'Depósito registrado.' : 'Retirada registrada.');
      setAmount(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar.');
    }
  }

  async function deleteGoal() {
    // Fecha antes: com o diálogo aberto, a invalidação pediria de novo a meta apagada e mostraria "Meta não encontrada".
    onOpenChange(false);
    try {
      await removeGoal.mutateAsync(goalId);
      toast.success('Meta excluída.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }

  async function deleteContribution(contributionId: string) {
    setError(null);
    try {
      await removeContribution.mutateAsync({ goalId, contributionId });
      toast.success('Lançamento apagado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível apagar.');
    }
  }

  if (editing && goal.data) return <GoalForm goal={goal.data} onOpenChange={(o) => !o && setEditing(false)} />;

  return (
    <Dialog open onOpenChange={onOpenChange} title={title}>
      {goal.isPending && <ListSkeleton rows={3} />}
      {goal.isError && <ErrorState message={goal.error.message} onRetry={() => goal.refetch()} />}
      {goal.data && (
        <div className="grid gap-6">
          <p className="text-sm text-muted">
            {`${formatBRL(goal.data.saved)} guardados de ${formatBRL(goal.data.targetAmount)} · prazo ${formatDate(goal.data.targetDate)}`}
          </p>

          <div className="grid gap-4 rounded-[var(--radius-control)] border border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor">
                <MoneyInput value={amount} onChange={setAmount} />
              </Field>
              <Field label="Data">
                <Input type="date" value={date} max={todayInSaoPaulo()} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
            {error && (
              <p role="alert" className="text-sm text-expense">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button loading={add.isPending} onClick={() => register(1)}>
                Registrar depósito
              </Button>
              <Button variant="secondary" loading={add.isPending} onClick={() => register(-1)}>
                Registrar retirada
              </Button>
            </div>
          </div>

          <section aria-label="Depósitos e retiradas" className="grid gap-2">
            <h3 className="font-semibold">Depósitos e retiradas</h3>
            {goal.data.contributions.length === 0 && <p className="text-sm text-muted">Nenhum depósito ainda.</p>}
            <ul className="grid gap-1">
              {goal.data.contributions.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                  <span className="text-muted">{formatDate(c.date)}</span>
                  <span className="flex items-center gap-2">
                    <span className={cn('tabular font-semibold', c.amount < 0 ? 'text-expense' : 'text-income')}>
                      {`${c.amount < 0 ? '−' : '+'}${formatBRL(Math.abs(c.amount))}`}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Apagar lançamento de ${formatDate(c.date)}`}
                      onClick={() => deleteContribution(c.id)}
                    >
                      <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
            {confirming ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Excluir a meta e os depósitos dela?</span>
                <Button size="sm" variant="danger" loading={removeGoal.isPending} onClick={deleteGoal}>
                  Confirmar exclusão
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button variant="ghost" className="text-expense" onClick={() => setConfirming(true)}>
                Excluir meta
              </Button>
            )}
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Editar meta
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
