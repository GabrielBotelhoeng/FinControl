import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { ApiError } from '../../lib/api-client';
import { formatBRL } from '../../lib/format';
import { useRemoveBudget, useSetBudget } from './api';

type Props = {
  category: { categoryId: string; name: string; suggested: number | null };
  current?: number;
  onOpenChange: (open: boolean) => void;
};

/** Limite mensal de uma categoria (P1), com a sugestão da média dos últimos 3 meses (P4). */
export function BudgetForm({ category, current, onOpenChange }: Props) {
  const save = useSetBudget();
  const remove = useRemoveBudget();
  const [limit, setLimit] = useState<number | null>(current ?? null);
  const [error, setError] = useState<string | undefined>();

  // PUT e DELETE não podem correr juntos: um PUT atrasado recriaria o limite removido.
  const busy = save.isPending || remove.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!limit) return setError('Informe o limite do mês.');
    try {
      await save.mutateAsync({ categoryId: category.categoryId, limit });
      toast.success('Limite salvo.');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    }
  }

  async function removeLimit() {
    if (busy) return;
    try {
      await remove.mutateAsync(category.categoryId);
      toast.success('Limite removido.');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível remover.');
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange} title={`Limite de ${category.name}`}>
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <Field label="Limite mensal" hint="Vale para todos os meses. Mudar o limite muda também os meses anteriores." error={error}>
          <MoneyInput value={limit} onChange={setLimit} autoFocus />
        </Field>
        {category.suggested !== null && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-surface-2 p-3 text-sm">
            <span>{`Sugestão: ${formatBRL(category.suggested)}, a média dos últimos 3 meses.`}</span>
            <Button size="sm" variant="secondary" onClick={() => setLimit(category.suggested)}>
              Usar sugestão
            </Button>
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          {current !== undefined ? (
            <Button variant="ghost" className="text-expense" loading={remove.isPending} disabled={save.isPending} onClick={removeLimit}>
              Remover limite
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending} disabled={remove.isPending}>
              Salvar limite
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
