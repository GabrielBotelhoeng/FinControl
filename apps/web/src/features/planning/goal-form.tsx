import { addMonthsToYm, dateInMonth, monthOf, todayInSaoPaulo, type GoalDTO } from '@fincontrol/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { ApiError } from '../../lib/api-client';
import { useCreateGoal, useUpdateGoal } from './api';

export type GoalDraft = { name: string; targetAmount: number | null; targetDate: string };

/** Mesmo dia daqui a `months` meses (limitado ao fim do mês). */
export const inMonths = (months: number) => {
  const today = todayInSaoPaulo();
  return dateInMonth(addMonthsToYm(monthOf(today), months), Number(today.slice(8, 10)));
};

type Props = { goal?: GoalDTO; draft?: GoalDraft; onOpenChange: (open: boolean) => void };

/** Criar ou editar uma meta (P6): nome, valor e prazo. */
export function GoalForm({ goal, draft, onOpenChange }: Props) {
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const [name, setName] = useState(goal?.name ?? draft?.name ?? '');
  const [targetAmount, setTargetAmount] = useState<number | null>(goal?.targetAmount ?? draft?.targetAmount ?? null);
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? draft?.targetDate ?? inMonths(12));
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Dê um nome para a meta.';
    if (!targetAmount) next.targetAmount = 'Informe quanto quer juntar.';
    if (!targetDate) next.targetDate = 'Informe o prazo.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !targetAmount) return;
    const input = { name: name.trim(), targetAmount, targetDate };
    try {
      if (goal) await update.mutateAsync({ id: goal.id, ...input });
      else await create.mutateAsync(input);
      toast.success(goal ? 'Meta atualizada.' : 'Meta criada.');
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length) setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
      else setErrors({ form: err instanceof Error ? err.message : 'Não foi possível salvar.' });
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange} title={goal ? 'Editar meta' : 'Nova meta'}>
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <Field label="Nome" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Viagem de férias" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor da meta" error={errors.targetAmount}>
            <MoneyInput value={targetAmount} onChange={setTargetAmount} />
          </Field>
          <Field label="Prazo" error={errors.targetDate}>
            <Input type="date" value={targetDate} min={todayInSaoPaulo()} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
        </div>
        {errors.form && (
          <p role="alert" className="text-sm text-expense">
            {errors.form}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            Salvar meta
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
