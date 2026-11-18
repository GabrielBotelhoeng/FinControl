import {
  addDays, addMonthsToYm, DEBT_KIND_LABELS, dateInMonth, debtKindSchema, monthOf, todayInSaoPaulo, type DebtDetailDTO, type DebtKind,
} from '@fincontrol/shared';
import { useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { controlClass, Field, Input, Select } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { ErrorState } from '../../components/ui/states';
import { ApiError } from '../../lib/api-client';
import { cn } from '../../lib/cn';
import { formatBRL, formatDate } from '../../lib/format';
import { useAccounts } from '../accounts/api';
import {
  useCancelDebtAgreement, useDebtAgreement, useDebtNote, useDebtPayment, useDebtValuation, useDeleteDebt, useUpdateDebt,
} from './api';

type DialogProps = { debt: DebtDetailDTO; onClose: () => void };

/** Erros de campo (400) ficam no campo; o resto (422 com a regra) vira aviso. */
function useErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.fieldErrors.length) setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
    else toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
  };
  return { errors, setErrors, fail };
}

function Actions({ onClose, loading, submit }: { onClose: () => void; loading: boolean; submit: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button variant="ghost" onClick={onClose} disabled={loading}>
        Cancelar
      </Button>
      <Button type="submit" loading={loading}>
        {submit}
      </Button>
    </div>
  );
}

type FormDialogProps = { title: string; pending: boolean; onClose: () => void; onSubmit: () => void; children: ReactNode };

/** Enquanto o envio não termina, o diálogo não fecha: reabrir e enviar de novo registraria o pagamento duas vezes. */
function FormDialog({ title, pending, onClose, onSubmit, children }: FormDialogProps) {
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="grid gap-5"
        noValidate
      >
        {children}
      </form>
    </Dialog>
  );
}

/** Contas que podem pagar: ativas e que não são cartão (mesma regra da API). */
function usePayers() {
  const accounts = useAccounts();
  return { accounts, payers: (accounts.data ?? []).filter((a) => a.archivedAt === null && a.type !== 'credit_card') };
}

function AccountSelect({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string | undefined }) {
  const { accounts, payers } = usePayers();
  const effective = value || payers[0]?.id || '';
  if (accounts.isError) return <ErrorState message={accounts.error.message} onRetry={() => accounts.refetch()} />;
  return (
    <Field label="Conta que paga" error={error ?? (accounts.data && payers.length === 0 ? 'Cadastre uma conta (que não seja cartão).' : undefined)}>
      <Select value={effective} onChange={(e) => onChange(e.target.value)} disabled={!accounts.data}>
        {payers.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

const firstPayer = (payers: { id: string }[], chosen: string) => chosen || payers[0]?.id || '';

export function EditDebtDialog({ debt, onClose }: DialogProps) {
  const update = useUpdateDebt();
  const { errors, setErrors, fail } = useErrors();
  const [name, setName] = useState(debt.name);
  const [creditor, setCreditor] = useState(debt.creditor);
  const [kind, setKind] = useState<DebtKind>(debt.kind);

  async function submit() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Dê um nome para a dívida.';
    if (!creditor.trim()) next.creditor = 'Informe para quem você deve.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await update.mutateAsync({ id: debt.id, name: name.trim(), creditor: creditor.trim(), kind });
      toast.success('Dívida atualizada.');
      onClose();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <FormDialog title="Editar dívida" pending={update.isPending} onClose={onClose} onSubmit={submit}>
      <Field label="Nome" error={errors.name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
      </Field>
      <Field label="Credor" error={errors.creditor}>
        <Input value={creditor} onChange={(e) => setCreditor(e.target.value)} maxLength={80} />
      </Field>
      <Field label="Tipo">
        <Select value={kind} onChange={(e) => setKind(e.target.value as DebtKind)}>
          {debtKindSchema.options.map((k) => (
            <option key={k} value={k}>
              {DEBT_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Actions onClose={onClose} loading={update.isPending} submit="Salvar" />
    </FormDialog>
  );
}

export function ValuationDialog({ debt, onClose }: DialogProps) {
  const valuation = useDebtValuation();
  const { errors, setErrors, fail } = useErrors();
  const [amount, setAmount] = useState<number | null>(debt.balance);
  const [note, setNote] = useState('');
  const diff = amount === null ? 0 : amount - debt.balance;

  async function submit() {
    if (amount === null) return setErrors({ amount: 'Informe o valor que o credor cobra hoje.' });
    try {
      await valuation.mutateAsync({ id: debt.id, amount, ...(note.trim() ? { note: note.trim() } : {}) });
      toast.success('Valor atualizado.');
      onClose();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <FormDialog title="Atualizar valor" pending={valuation.isPending} onClose={onClose} onSubmit={submit}>
      <p className="text-sm text-muted">Use quando o credor mandar um valor novo, com juros e multa ou com desconto.</p>
      <Field label="Quanto você deve hoje" error={errors.amount}>
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      {diff !== 0 && (
        <p aria-live="polite" className="text-sm">
          {diff > 0 ? `${formatBRL(diff)} a mais: entra em juros e multas.` : `${formatBRL(-diff)} a menos: entra em descontos.`}
        </p>
      )}
      <Field label="Observação (opcional)" error={errors.note}>
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} placeholder="Ex.: boleto novo de novembro" />
      </Field>
      <Actions onClose={onClose} loading={valuation.isPending} submit="Atualizar" />
    </FormDialog>
  );
}

export function NoteDialog({ debt, onClose }: DialogProps) {
  const add = useDebtNote();
  const { errors, setErrors, fail } = useErrors();
  const [text, setText] = useState('');
  const [amount, setAmount] = useState<number | null>(null);

  async function submit() {
    if (!text.trim()) return setErrors({ text: 'Conte o que aconteceu na negociação.' });
    try {
      await add.mutateAsync({ id: debt.id, text: text.trim(), ...(amount ? { amount } : {}) });
      toast.success('Negociação registrada.');
      onClose();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <FormDialog title="Registrar negociação" pending={add.isPending} onClose={onClose} onSubmit={submit}>
      <Field label="O que aconteceu" error={errors.text}>
        <textarea
          className={cn(controlClass, 'h-28 resize-none py-3')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={280}
          placeholder="Ex.: Liguei e ofereceram 40% de desconto à vista."
          autoFocus
        />
      </Field>
      <Field label="Valor proposto (opcional)" hint="Não muda o saldo; serve para comparar as propostas." error={errors.amount}>
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <Actions onClose={onClose} loading={add.isPending} submit="Registrar" />
    </FormDialog>
  );
}

export function AgreementDialog({ debt, onClose }: DialogProps) {
  const create = useDebtAgreement();
  const { accounts, payers } = usePayers();
  const { errors, setErrors, fail } = useErrors();
  const today = todayInSaoPaulo();
  const [downPayment, setDownPayment] = useState<number | null>(null);
  const [installments, setInstallments] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState<number | null>(null);
  const [firstDueDate, setFirstDueDate] = useState(dateInMonth(addMonthsToYm(monthOf(today), 1), Number(today.slice(8, 10))));
  const [accountId, setAccountId] = useState('');
  const n = /^\d+$/.test(installments.trim()) ? Number(installments.trim()) : NaN;
  const total = n >= 1 && installmentAmount ? (downPayment ?? 0) + n * installmentAmount : null;

  async function submit() {
    const next: Record<string, string> = {};
    if (!(n >= 1 && n <= 120)) next.installments = 'Informe de 1 a 120 parcelas.';
    if (!installmentAmount) next.installmentAmount = 'Informe o valor da parcela.';
    if (!firstDueDate || firstDueDate < today) next.firstDueDate = 'O 1º vencimento não pode estar no passado.';
    else if (firstDueDate > addDays(today, 366)) next.firstDueDate = 'O 1º vencimento deve ser em até 1 ano.';
    const account = firstPayer(payers, accountId);
    if (!accounts.data) next.accountId = 'As contas ainda não carregaram.';
    else if (!account) next.accountId = 'Cadastre uma conta (que não seja cartão).';
    setErrors(next);
    if (Object.keys(next).length || !installmentAmount) return;
    try {
      await create.mutateAsync({ id: debt.id, downPayment: downPayment ?? 0, installments: n, installmentAmount, firstDueDate, accountId: account });
      toast.success('Acordo registrado. As parcelas estão em Lançamentos.');
      onClose();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <FormDialog title="Fechar acordo" pending={create.isPending} onClose={onClose} onSubmit={submit}>
      <p className="text-sm text-muted">{`Saldo de hoje: ${formatBRL(debt.balance)}. A entrada é registrada como paga hoje e as parcelas entram em Lançamentos.`}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Entrada (opcional)" error={errors.downPayment}>
          <MoneyInput value={downPayment} onChange={setDownPayment} autoFocus />
        </Field>
        <Field label="Número de parcelas" error={errors.installments}>
          <Input type="number" inputMode="numeric" min={1} max={120} value={installments} onChange={(e) => setInstallments(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor da parcela" error={errors.installmentAmount}>
          <MoneyInput value={installmentAmount} onChange={setInstallmentAmount} />
        </Field>
        <Field label="Vencimento da 1ª parcela" error={errors.firstDueDate}>
          <Input type="date" value={firstDueDate} min={today} max={addDays(today, 366)} onChange={(e) => setFirstDueDate(e.target.value)} />
        </Field>
      </div>
      <AccountSelect value={accountId} onChange={setAccountId} error={errors.accountId} />
      {total !== null && (
        <p aria-live="polite" className="rounded-[var(--radius-control)] border border-border bg-surface-2 p-4 text-sm">
          {total < debt.balance
            ? `Total do acordo ${formatBRL(total)}: ${formatBRL(debt.balance - total)} de desconto.`
            : total > debt.balance
              ? `Total do acordo ${formatBRL(total)}: ${formatBRL(total - debt.balance)} a mais que o saldo de hoje.`
              : `Total do acordo ${formatBRL(total)}: igual ao saldo de hoje.`}
        </p>
      )}
      <Actions onClose={onClose} loading={create.isPending} submit="Fechar acordo" />
    </FormDialog>
  );
}

export function PaymentDialog({ debt, onClose }: DialogProps) {
  const pay = useDebtPayment();
  const { accounts, payers } = usePayers();
  const { errors, setErrors, fail } = useErrors();
  const today = todayInSaoPaulo();
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState('');
  const min = debt.lastAnchorDate ?? undefined;

  async function submit() {
    const next: Record<string, string> = {};
    if (!amount) next.amount = 'Informe quanto você pagou.';
    else if (amount > debt.balance) next.amount = `O saldo é ${formatBRL(debt.balance)}. Atualize o valor antes, se ele mudou.`;
    if (!date || date > today) next.date = 'A data não pode estar no futuro.';
    else if (min && date < min) next.date = `A data não pode ser anterior a ${formatDate(min)}, a última atualização do valor.`;
    const account = firstPayer(payers, accountId);
    if (!accounts.data) next.accountId = 'As contas ainda não carregaram.';
    else if (!account) next.accountId = 'Cadastre uma conta (que não seja cartão).';
    setErrors(next);
    if (Object.keys(next).length || !amount) return;
    try {
      await pay.mutateAsync({ id: debt.id, amount, date, accountId: account });
      toast.success('Pagamento registrado.');
      onClose();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <FormDialog title="Registrar pagamento" pending={pay.isPending} onClose={onClose} onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor pago" error={errors.amount}>
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
        </Field>
        <Field label="Data" error={errors.date}>
          <Input type="date" value={date} min={min} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <AccountSelect value={accountId} onChange={setAccountId} error={errors.accountId} />
      <Actions onClose={onClose} loading={pay.isPending} submit="Registrar" />
    </FormDialog>
  );
}

function ConfirmDialog(props: { title: string; text: string; confirm: string; loading: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && !props.loading && props.onClose()} title={props.title}>
      <p className="text-sm text-muted">{props.text}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={props.onClose} disabled={props.loading}>
          Voltar
        </Button>
        <Button className="bg-expense text-white" loading={props.loading} onClick={props.onConfirm}>
          {props.confirm}
        </Button>
      </div>
    </Dialog>
  );
}

export function CancelAgreementDialog({ debt, onClose }: DialogProps) {
  const cancel = useCancelDebtAgreement();
  async function confirm() {
    try {
      await cancel.mutateAsync(debt.id);
      toast.success('Acordo cancelado.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cancelar.');
    }
  }
  return (
    <ConfirmDialog
      title="Cancelar acordo?"
      text={`As parcelas que faltam pagar serão apagadas de Lançamentos. A dívida volta a ficar em aberto com ${formatBRL(debt.balance)}, e você pode atualizar o valor depois.`}
      confirm="Cancelar acordo"
      loading={cancel.isPending}
      onConfirm={confirm}
      onClose={onClose}
    />
  );
}

export function DeleteDebtDialog({ debt, onClose, onDeleting }: DialogProps & { onDeleting: (deleting: boolean) => void }) {
  const remove = useDeleteDebt();
  const navigate = useNavigate();
  async function confirm() {
    // Desliga a consulta do detalhe antes de excluir: a invalidação depois da exclusão não pede a dívida apagada.
    flushSync(() => onDeleting(true));
    try {
      await remove.mutateAsync(debt.id);
      toast.success('Dívida excluída.');
      navigate('/dividas');
    } catch (err) {
      onDeleting(false);
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }
  return (
    <ConfirmDialog
      title="Excluir dívida?"
      text="O histórico e as parcelas pendentes serão apagados. Os pagamentos já feitos continuam em Lançamentos."
      confirm="Excluir"
      loading={remove.isPending}
      onConfirm={confirm}
      onClose={onClose}
    />
  );
}
