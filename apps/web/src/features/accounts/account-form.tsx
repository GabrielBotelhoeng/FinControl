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

export function AccountForm({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account?: AccountDTO }) {
  const save = useSaveAccount();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'checking');
  const [color, setColor] = useState<string>(account?.color ?? SWATCHES[0]);
  const [initialBalance, setInitialBalance] = useState<number | null>(account ? account.initialBalance : null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErrors({ name: 'Dê um nome para a conta.' });
    try {
      await save.mutateAsync({ id: account?.id, name: name.trim(), type, color, initialBalance: initialBalance ?? 0 });
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
          <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Saldo inicial" hint="Quanto havia na conta quando você começou a usar o FinControl." error={errors.initialBalance}>
          <MoneyInput value={initialBalance} onChange={setInitialBalance} />
        </Field>
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
