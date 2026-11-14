import type { AccountDTO } from '@fincontrol/shared';
import { Field, Input, Select } from '../../components/ui/field';
import { MoneyInput } from '../../components/ui/money-input';

export type CardFormValues = { creditLimit: number | null; closingDay: number | null; dueDay: number | null; paymentAccountId: string };

type Props = {
  value: CardFormValues;
  onChange: (value: CardFormValues) => void;
  paymentAccounts: AccountDTO[];
  errors: Record<string, string>;
};

/** Campos exclusivos do cartão de crédito (limite, fechamento, vencimento e conta pagadora); extraídos do AccountForm por tamanho. */
export function CardFields({ value, onChange, paymentAccounts, errors }: Props) {
  const set = <K extends keyof CardFormValues>(key: K, v: CardFormValues[K]) => onChange({ ...value, [key]: v });

  return (
    <>
      <Field label="Limite" error={errors.creditLimit}>
        <MoneyInput value={value.creditLimit} onChange={(v) => set('creditLimit', v)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dia de fechamento" error={errors.closingDay}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={value.closingDay ?? ''}
            onChange={(e) => set('closingDay', e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
        <Field label="Dia de vencimento" error={errors.dueDay}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={value.dueDay ?? ''}
            onChange={(e) => set('dueDay', e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
      </div>
      <Field label="Conta para pagar a fatura" error={errors.paymentAccountId}>
        <Select value={value.paymentAccountId} onChange={(e) => set('paymentAccountId', e.target.value)}>
          <option value="">Escolha a conta</option>
          {paymentAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
