import {
  addMonthsToYm, dateInMonth, LOAN_KIND_LABELS, loanKindSchema, loanSummary, monthOf, todayInSaoPaulo, type LoanKind,
} from '@fincontrol/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input, Select } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { ErrorState } from '../../components/ui/states';
import { ApiError } from '../../lib/api-client';
import { formatBRL, formatRate } from '../../lib/format';
import { useAccounts } from '../accounts/api';
import { useCreateLoan } from './api';
import { BankPicker, type BankValue } from './bank-picker';

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

const KINDS = loanKindSchema.options;

/** "2,5" → 0,025 (fração ao mês); vazio → undefined; texto inválido → NaN. */
function parseRate(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  return Number(t.replace(',', '.')) / 100;
}

const toInt = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN);

/**
 * Cadastro do empréstimo com o que a pessoa sabe (spec C8): valor recebido, parcela e número de parcelas.
 * A prévia mostra a taxa real antes de salvar, com a mesma conta da API (`loanSummary`, D6).
 */
export function LoanForm({ open, onOpenChange }: Props) {
  const accounts = useAccounts();
  const create = useCreateLoan();
  const today = todayInSaoPaulo();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<LoanKind>('personal');
  const [bank, setBank] = useState<BankValue>({ name: '', cnpj8: null });
  const [principal, setPrincipal] = useState<number | null>(null);
  const [installmentAmount, setInstallmentAmount] = useState<number | null>(null);
  const [total, setTotal] = useState('');
  const [paidBefore, setPaidBefore] = useState('0');
  const [firstDueDate, setFirstDueDate] = useState(dateInMonth(addMonthsToYm(monthOf(today), 1), Number(today.slice(8, 10))));
  const [accountId, setAccountId] = useState('');
  const [rate, setRate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const payers = (accounts.data ?? []).filter((a) => a.archivedAt === null && a.type !== 'credit_card');
  const effectiveAccount = accountId || payers[0]?.id || '';
  const n = toInt(total);
  const paid = toInt(paidBefore);
  const preview = principal && installmentAmount && n >= 1 ? loanSummary({ principal, installmentAmount, installmentsTotal: n, installmentsPaid: 0 }) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const informed = parseRate(rate);
    if (!name.trim()) next.name = 'Dê um nome para o empréstimo.';
    if (!bank.name.trim()) next.bankName = 'Informe o banco.';
    if (!principal) next.principal = 'Informe quanto você recebeu.';
    if (!installmentAmount) next.installmentAmount = 'Informe o valor da parcela.';
    if (!(n >= 1 && n <= 480)) next.installmentsTotal = 'Informe de 1 a 480 parcelas.';
    if (!(paid >= 0)) next.installmentsPaidBefore = 'Informe um número inteiro.';
    else if (n >= 1 && paid >= n) next.installmentsPaidBefore = 'Já pagas precisa ser menor que o total de parcelas';
    if (!accounts.data) next.accountId = 'As contas ainda não carregaram.';
    else if (!effectiveAccount) next.accountId = 'Cadastre uma conta (que não seja cartão) para pagar as parcelas.';
    if (informed !== undefined && !(informed > 0 && informed <= 1)) next.informedMonthlyRate = 'Informe a taxa em % ao mês, por exemplo 2,5.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !principal || !installmentAmount) return;

    try {
      await create.mutateAsync({
        name: name.trim(), kind, bankName: bank.name.trim(), ...(bank.cnpj8 ? { bankCnpj8: bank.cnpj8 } : {}),
        principal, installmentAmount, installmentsTotal: n, installmentsPaidBefore: paid, firstDueDate,
        accountId: effectiveAccount, ...(informed !== undefined ? { informedMonthlyRate: informed } : {}),
      });
      toast.success('Empréstimo cadastrado.');
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length) setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
      else toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Novo empréstimo">
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <Field label="Nome" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex.: Financiamento do carro" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Select value={kind} onChange={(e) => setKind(e.target.value as LoanKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {LOAN_KIND_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Banco" error={errors.bankName ?? errors.bankCnpj8}>
            <BankPicker value={bank} onChange={setBank} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor recebido" hint="O que caiu na sua conta." error={errors.principal}>
            <MoneyInput value={principal} onChange={setPrincipal} />
          </Field>
          <Field label="Valor da parcela" error={errors.installmentAmount}>
            <MoneyInput value={installmentAmount} onChange={setInstallmentAmount} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número de parcelas" error={errors.installmentsTotal}>
            <Input type="number" inputMode="numeric" min={1} max={480} value={total} onChange={(e) => setTotal(e.target.value)} />
          </Field>
          <Field label="Parcelas já pagas" hint="As que você pagou antes de usar o FinControl." error={errors.installmentsPaidBefore}>
            <Input type="number" inputMode="numeric" min={0} value={paidBefore} onChange={(e) => setPaidBefore(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vencimento da 1ª parcela" error={errors.firstDueDate}>
            <Input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
          </Field>
          <Field label="Conta que paga" error={accounts.isError ? undefined : errors.accountId}>
            <Select value={effectiveAccount} onChange={(e) => setAccountId(e.target.value)} disabled={!accounts.data}>
              {payers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {accounts.isError && <ErrorState message={accounts.error.message} onRetry={() => accounts.refetch()} />}
        <Field label="Taxa informada (opcional)" hint="Em % ao mês, como está no contrato. Serve só para conferir." error={errors.informedMonthlyRate}>
          <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Ex.: 2,5" />
        </Field>

        {preview && (
          <div aria-live="polite" className="grid gap-1 rounded-[var(--radius-control)] border border-border bg-surface-2 p-4 text-sm">
            <p className="font-semibold">{`Taxa real: ${formatRate(preview.monthlyRate)} ao mês (${formatRate(preview.annualRate)} ao ano)`}</p>
            <p className="text-muted">
              {`Você recebeu ${formatBRL(principal!)} e vai devolver ${formatBRL(preview.totalCost)}. ${formatBRL(preview.interest)} são juros.`}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Salvar empréstimo
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
