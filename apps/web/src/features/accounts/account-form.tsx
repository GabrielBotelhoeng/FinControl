import type { AccountDTO, AccountType } from '@fincontrol/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input, Select } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';
import { SwatchPicker } from '../../components/ui/swatch-picker';
import { ApiError } from '../../lib/api-client';
import { SWATCHES } from '../../lib/swatches';
import { ACCOUNT_TYPES, useSaveAccount } from './api';
import { CardFields, type CardFormValues } from './card-fields';

type Props = { open: boolean; onOpenChange: (o: boolean) => void; account?: AccountDTO; accounts: AccountDTO[] };

export function AccountForm({ open, onOpenChange, account, accounts }: Props) {
  const save = useSaveAccount();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'checking');
  const [color, setColor] = useState<string>(account?.color ?? SWATCHES[0]);
  const [initialBalance, setInitialBalance] = useState<number | null>(account ? account.initialBalance : null);
  const [card, setCard] = useState<CardFormValues>({
    creditLimit: account?.creditLimit ?? null,
    closingDay: account?.closingDay ?? null,
    dueDay: account?.dueDay ?? null,
    paymentAccountId: account?.paymentAccountId ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isCardType = type === 'credit_card';
  // Decisão R9: numa conta existente o tipo não muda de/para cartão. Editar um cartão trava o tipo (Select
  // desabilitado); editar uma conta comum esconde "Cartão de crédito" das opções.
  const typeLocked = account?.type === 'credit_card';
  const typeOptions = account && account.type !== 'credit_card' ? ACCOUNT_TYPES.filter((t) => t.value !== 'credit_card') : ACCOUNT_TYPES;
  const paymentAccounts = accounts.filter((a) => a.archivedAt === null && a.type !== 'credit_card');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Dê um nome para a conta.';
    if (isCardType) {
      if (card.creditLimit == null) nextErrors.creditLimit = 'Informe o limite do cartão';
      if (card.closingDay == null) nextErrors.closingDay = 'Informe o dia de fechamento da fatura';
      else if (card.closingDay < 1 || card.closingDay > 31) nextErrors.closingDay = 'Dia deve ser entre 1 e 31';
      if (card.dueDay == null) nextErrors.dueDay = 'Informe o dia de vencimento da fatura';
      else if (card.dueDay < 1 || card.dueDay > 31) nextErrors.dueDay = 'Dia deve ser entre 1 e 31';
      if (!card.paymentAccountId) nextErrors.paymentAccountId = 'Informe a conta usada para pagar a fatura';
    }
    if (Object.keys(nextErrors).length > 0) return setErrors(nextErrors);

    try {
      await save.mutateAsync({
        id: account?.id,
        name: name.trim(),
        type,
        color,
        initialBalance: isCardType ? 0 : initialBalance ?? 0,
        ...(isCardType
          ? { creditLimit: card.creditLimit ?? undefined, closingDay: card.closingDay ?? undefined, dueDay: card.dueDay ?? undefined, paymentAccountId: card.paymentAccountId }
          : {}),
      });
      toast.success(account ? 'Conta atualizada.' : 'Conta criada.');
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
        if (!err.fieldErrors.length) toast.error(err.message);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={account ? 'Editar conta' : 'Nova conta'}>
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <Field label="Nome" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank, Carteira" autoFocus />
        </Field>
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value as AccountType)} disabled={typeLocked}>
            {typeOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        {isCardType ? (
          <CardFields value={card} onChange={setCard} paymentAccounts={paymentAccounts} errors={errors} />
        ) : (
          <Field label="Saldo inicial" hint="Quanto havia na conta quando você começou a usar o FinControl." error={errors.initialBalance}>
            <MoneyInput value={initialBalance} onChange={setInitialBalance} />
          </Field>
        )}
        <SwatchPicker value={color} onChange={setColor} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            Salvar conta
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
