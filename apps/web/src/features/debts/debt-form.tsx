import { DEBT_KIND_LABELS, debtKindSchema, todayInSaoPaulo, type DebtKind } from '@fincontrol/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input, Select } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { ApiError } from '../../lib/api-client';
import { formatBRL } from '../../lib/format';
import { useCreateDebt } from './api';

const KINDS = debtKindSchema.options;

/** Cadastro (V4): o valor original e, se o credor já cobra mais (ou menos), o valor de hoje. */
export function DebtForm({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateDebt();
  const navigate = useNavigate();
  const today = todayInSaoPaulo();
  const [name, setName] = useState('');
  const [creditor, setCreditor] = useState('');
  const [kind, setKind] = useState<DebtKind>('store');
  const [original, setOriginal] = useState<number | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [since, setSince] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const increase = original && current ? current - original : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Dê um nome para a dívida.';
    if (!creditor.trim()) next.creditor = 'Informe para quem você deve.';
    if (!original) next.originalAmount = 'Informe o valor original.';
    if (!since || since > today) next.since = 'A data não pode estar no futuro.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !original) return;
    try {
      const created = await create.mutateAsync({
        name: name.trim(), creditor: creditor.trim(), kind, originalAmount: original, since, ...(current ? { currentAmount: current } : {}),
      });
      toast.success('Dívida cadastrada.');
      onOpenChange(false);
      navigate(`/dividas/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length) setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
      else toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o || !create.isPending) && onOpenChange(o)} title="Nova dívida">
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <Field label="Nome" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex.: Crediário do sofá" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Credor" hint="Para quem você deve." error={errors.creditor}>
            <Input value={creditor} onChange={(e) => setCreditor(e.target.value)} maxLength={80} placeholder="Ex.: Loja de móveis" />
          </Field>
          <Field label="Tipo">
            <Select value={kind} onChange={(e) => setKind(e.target.value as DebtKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {DEBT_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor original" hint="Quanto era a dívida no começo." error={errors.originalAmount}>
            <MoneyInput value={original} onChange={setOriginal} />
          </Field>
          <Field label="Deve desde" error={errors.since}>
            <Input type="date" value={since} max={today} onChange={(e) => setSince(e.target.value)} />
          </Field>
        </div>
        <Field label="Valor hoje (opcional)" hint="Quanto o credor cobra hoje, com juros e multa." error={errors.currentAmount}>
          <MoneyInput value={current} onChange={setCurrent} />
        </Field>
        {increase !== 0 && (
          <p aria-live="polite" className="rounded-[var(--radius-control)] border border-border bg-surface-2 p-4 text-sm">
            {increase > 0 ? `${formatBRL(increase)} de juros e multas desde o começo.` : `${formatBRL(-increase)} a menos que o valor original.`}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Salvar dívida
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
