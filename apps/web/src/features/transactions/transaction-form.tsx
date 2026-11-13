import { todayInSaoPaulo, type Frequency, type Scope, type TransactionDTO, type TransactionType } from '@fincontrol/shared';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input, Select } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { Segmented } from '../../components/ui/segmented';
import { ApiError } from '../../lib/api-client';
import { useAccounts } from '../accounts/api';
import { useCategories } from '../categories/api';
import { useCreateTransaction, useDeleteTransaction, useUpdateTransaction, type TransactionFields } from './api';
import { CardPurchaseFields } from './card-purchase-fields';
import { ScopeDialog } from './scope-dialog';

type Props = { open: boolean; onOpenChange: (o: boolean) => void; transaction?: TransactionDTO; defaultType?: TransactionType };

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Despesa' },
  { value: 'income', label: 'Receita' },
  { value: 'transfer', label: 'Transferência' },
];

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'monthly', label: 'Todo mês' },
  { value: 'weekly', label: 'Toda semana' },
  { value: 'yearly', label: 'Todo ano' },
];

export function TransactionForm({ open, onOpenChange, transaction, defaultType = 'expense' }: Props) {
  const editing = Boolean(transaction);
  const accounts = useAccounts();
  const categories = useCategories();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();

  const [type, setType] = useState<TransactionType>(transaction?.type ?? defaultType);
  const [amount, setAmount] = useState<number | null>(transaction?.amount ?? null);
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [accountId, setAccountId] = useState(transaction?.accountId ?? '');
  const [destinationAccountId, setDestination] = useState(transaction?.destinationAccountId ?? '');
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? '');
  const [nature, setNature] = useState<'fixed' | 'variable'>(transaction?.nature ?? 'variable');
  const [dueDate, setDueDate] = useState(transaction?.dueDate ?? todayInSaoPaulo());
  const [paid, setPaid] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [endDate, setEndDate] = useState('');
  const [installments, setInstallments] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingScope, setPendingScope] = useState<null | { action: 'edit' | 'delete'; fields?: TransactionFields }>(null);

  const accountList = (accounts.data ?? []).filter((a) => a.archivedAt === null || a.id === transaction?.accountId);
  const categoryList = (categories.data ?? []).filter((c) => c.type === type);
  const firstAccount = accountList[0]?.id ?? '';
  const effectiveAccount = accountId || firstAccount;
  const effectiveCategory = type === 'transfer' ? null : categoryId || categoryList[0]?.id || null;
  const isTransfer = type === 'transfer';
  const selectedAccount = accountList.find((a) => a.id === effectiveAccount);
  // Compra no cartão (decisão R19): só type "expense" é um lançamento de cartão válido (receita/transferência
  // num cartão são 422 na API). Trava conta+data na edição e esconde pago/recorrência e mostra "Parcelar em".
  const isCardPurchase = type === 'expense' && selectedAccount?.type === 'credit_card';

  function fields(): TransactionFields | null {
    const next: Record<string, string> = {};
    if (!amount) next.amount = 'Informe o valor.';
    if (!description.trim()) next.description = 'Descreva o lançamento.';
    if (!effectiveAccount) next.accountId = 'Cadastre uma conta antes de lançar.';
    if (isTransfer && (!destinationAccountId || destinationAccountId === effectiveAccount)) next.destinationAccountId = 'Escolha uma conta de destino diferente.';
    if (!isTransfer && !effectiveCategory) next.categoryId = 'Escolha uma categoria.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !amount) return null;
    return {
      amount,
      description: description.trim(),
      accountId: effectiveAccount,
      destinationAccountId: isTransfer ? destinationAccountId : null,
      categoryId: effectiveCategory,
      nature: isTransfer ? null : nature,
      dueDate,
    };
  }

  function handleError(err: unknown) {
    if (err instanceof ApiError && err.fieldErrors.length) setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
    else toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
  }

  async function runUpdate(scope: Scope, data: TransactionFields) {
    if (!transaction) return;
    try {
      await update.mutateAsync({ id: transaction.id, scope, fields: data });
      toast.success('Lançamento atualizado.');
      onOpenChange(false);
    } catch (err) {
      handleError(err);
    }
  }

  async function runDelete(scope: Scope) {
    if (!transaction) return;
    try {
      await remove.mutateAsync({ id: transaction.id, scope });
      toast.success('Lançamento excluído.');
      onOpenChange(false);
    } catch (err) {
      handleError(err);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const data = fields();
    if (!data) return;
    if (transaction) {
      if (transaction.recurrenceId) setPendingScope({ action: 'edit', fields: data });
      else await runUpdate('single', data);
      return;
    }
    try {
      await create.mutateAsync({
        ...data,
        type,
        status: paid ? 'paid' : 'pending',
        recurrence: repeat ? { frequency, endDate: endDate || null } : null,
        // 1x é à vista e não envia `installments` (decisão R19); a API só aceita o campo numa compra de cartão.
        ...(isCardPurchase && installments > 1 ? { installments } : {}),
      });
      toast.success(isTransfer ? 'Transferência registrada.' : 'Lançamento criado.');
      onOpenChange(false);
    } catch (err) {
      handleError(err);
    }
  }

  return (
    <>
      <Dialog open={open && !pendingScope} onOpenChange={onOpenChange} title={editing ? 'Editar lançamento' : 'Novo lançamento'}>
        <form onSubmit={submit} className="grid gap-5" noValidate>
          {!editing && (
            <Segmented
              label="Tipo de lançamento"
              value={type}
              onChange={(t) => {
                setType(t);
                setCategoryId('');
              }}
              options={TYPE_OPTIONS}
              className="w-full [&>button]:flex-1"
            />
          )}
          <Field label="Valor" error={errors.amount}>
            <MoneyInput value={amount} onChange={setAmount} autoFocus={!editing} />
          </Field>
          <Field label="Descrição" error={errors.description}>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder={isTransfer ? 'Ex.: Reserva de emergência' : 'Ex.: Mercado do mês'} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isTransfer ? 'De' : 'Conta'} error={errors.accountId}>
              <Select
                value={effectiveAccount}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={editing && isCardPurchase}
              >
                {accountList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            {isTransfer ? (
              <Field label="Para" error={errors.destinationAccountId}>
                <Select value={destinationAccountId} onChange={(e) => setDestination(e.target.value)}>
                  <option value="">Escolha a conta</option>
                  {accountList
                    .filter((a) => a.id !== effectiveAccount)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </Select>
              </Field>
            ) : (
              <Field label="Categoria" error={errors.categoryId}>
                <Select value={effectiveCategory ?? ''} onChange={(e) => setCategoryId(e.target.value)}>
                  {categoryList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isCardPurchase ? 'Data da compra' : 'Vencimento'}>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={editing && isCardPurchase} />
            </Field>
            {!isTransfer && (
              <div className="grid gap-2">
                <span className="text-sm font-medium">Natureza</span>
                <Segmented
                  label="Natureza"
                  value={nature}
                  onChange={setNature}
                  options={[
                    { value: 'fixed', label: 'Fixa' },
                    { value: 'variable', label: 'Variável' },
                  ]}
                />
              </div>
            )}
          </div>
          {!editing && isCardPurchase && selectedAccount && (
            <CardPurchaseFields
              card={selectedAccount}
              amount={amount}
              purchaseDate={dueDate}
              installments={installments}
              onInstallmentsChange={setInstallments}
            />
          )}
          {!editing && !isCardPurchase && (
            <div className="grid gap-3 rounded-[var(--radius-control)] border border-border p-4">
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
                Já está pago
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
                Repetir este lançamento
              </label>
              {repeat && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Frequência">
                    <Select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                      {FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Termina em" hint="Deixe vazio para repetir sem fim." error={errors['recurrence.endDate']}>
                    <Input type="date" value={endDate} min={dueDate} onChange={(e) => setEndDate(e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {editing ? (
              <Button
                variant="ghost"
                className="text-expense"
                onClick={() => (transaction?.recurrenceId ? setPendingScope({ action: 'delete' }) : runDelete('single'))}
              >
                <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={create.isPending || update.isPending}>
                Salvar lançamento
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
      {pendingScope && (
        <ScopeDialog
          action={pendingScope.action}
          onCancel={() => setPendingScope(null)}
          onChoose={(scope) => {
            const pending = pendingScope;
            setPendingScope(null);
            if (pending.action === 'edit' && pending.fields) void runUpdate(scope, pending.fields);
            else void runDelete(scope);
          }}
        />
      )}
    </>
  );
}
