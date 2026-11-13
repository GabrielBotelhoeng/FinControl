import { todayInSaoPaulo, type AccountDTO, type YearMonth } from '@fincontrol/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input, Select } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { ApiError } from '../../lib/api-client';
import { usePayInvoice } from './api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  month: YearMonth;
  remaining: number;
  paymentAccountId: string | null;
  accounts: AccountDTO[];
};

/**
 * Diálogo "Pagar fatura" (decisão do controlador, Tarefa 11): valor sugerido = restante; opções = contas
 * ativas que não são cartão; conta padrão = `paymentAccountId` do cartão se ela estiver ativa e não for
 * cartão, senão a primeira conta ativa elegível; data padrão = hoje, sem data futura.
 */
export function PayInvoiceDialog({ open, onOpenChange, cardId, month, remaining, paymentAccountId, accounts }: Props) {
  const pay = usePayInvoice();
  const eligible = accounts.filter((a) => a.archivedAt === null && a.type !== 'credit_card');
  const defaultAccountId = eligible.find((a) => a.id === paymentAccountId)?.id ?? eligible[0]?.id ?? '';
  const today = todayInSaoPaulo();

  const [amount, setAmount] = useState<number | null>(remaining);
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [paidDate, setPaidDate] = useState(today);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return setError('Informe o valor do pagamento.');
    if (!accountId) return setError('Escolha a conta pagadora.');
    setError(null);
    try {
      await pay.mutateAsync({ cardId, month, amount, accountId, paidDate });
      toast.success('Pagamento registrado.');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar o pagamento.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Pagar fatura">
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <Field label="Valor">
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
        </Field>
        <Field label="Conta pagadora">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {eligible.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data do pagamento">
          <Input type="date" value={paidDate} max={today} onChange={(e) => setPaidDate(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={pay.isPending}>
            Pagar fatura
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
