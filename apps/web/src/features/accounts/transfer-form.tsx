import { todayInSaoPaulo, type AccountDTO } from '@fincontrol/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input, Select } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { ApiError } from '../../lib/api-client';
import { useTransfer } from './api';

export function TransferForm({ open, onOpenChange, accounts }: { open: boolean; onOpenChange: (o: boolean) => void; accounts: AccountDTO[] }) {
  const transfer = useTransfer();
  // Decisão R18: cartão não entra como origem nem destino (a API recusa com 422); pagar fatura é na tela de faturas.
  // accounts-page.tsx só mostra "Transferir" havendo 2+ elegíveis; o fallback abaixo é só salvaguarda (ex.: a
  // lista mudar entre abrir o diálogo e este estado inicial) — nunca deixa `to` num valor sem <option> igual.
  const eligible = accounts.filter((a) => a.type !== 'credit_card');
  const [from, setFrom] = useState(eligible[0]?.id ?? '');
  const [to, setTo] = useState(eligible[1]?.id ?? eligible[0]?.id ?? '');
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(todayInSaoPaulo());
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return setError('Informe o valor da transferência.');
    if (from === to) return setError('Escolha contas diferentes.');
    try {
      await transfer.mutateAsync({ accountId: from, destinationAccountId: to, amount, dueDate: date, description: 'Transferência entre contas' });
      toast.success('Transferência registrada.');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível transferir.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Transferir entre contas">
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="De">
            <Select value={from} onChange={(e) => setFrom(e.target.value)}>
              {eligible.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Para">
            <Select value={to} onChange={(e) => setTo(e.target.value)}>
              {eligible.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Valor">
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="Data">
          <Input type="date" value={date} max={todayInSaoPaulo()} onChange={(e) => setDate(e.target.value)} />
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
          <Button type="submit" loading={transfer.isPending}>
            Transferir
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
