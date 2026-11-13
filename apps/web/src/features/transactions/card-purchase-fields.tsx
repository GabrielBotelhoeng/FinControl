import { invoiceFor, splitInstallments, type AccountDTO, type DateOnly } from '@fincontrol/shared';
import { Field, Select } from '../../components/ui/field';
import { formatBRL, formatMonthShort } from '../../lib/format';

const INSTALLMENT_OPTIONS = Array.from({ length: 48 }, (_, i) => i + 1);

/** "10x de R$ 120,00" (parcelas iguais) ou "1ª de R$ 333,34 + 2x de R$ 333,33" (a 1ª leva o resto, spec C5). */
function installmentsText(amount: number, n: number): string | null {
  if (n <= 1) return null;
  // splitInstallments só varia a 1ª parcela (o resto da divisão); comparar as 2 primeiras basta para saber
  // se todas são iguais. Os defaults também satisfazem o TS sob `noUncheckedIndexedAccess`.
  const [first = 0, second = first] = splitInstallments(amount, n);
  return first === second ? `${n}x de ${formatBRL(first)}` : `1ª de ${formatBRL(first)} + ${n - 1}x de ${formatBRL(second)}`;
}

/**
 * Prévia da compra no cartão (decisão do controlador, Tarefa 11): o texto das parcelas (quando n > 1) seguido
 * de " · primeira fatura: <mês abreviado>/<ano>", usando `invoiceFor` (spec §6). `null` sem valor informado
 * ou sem fechamento/vencimento configurados (nunca deveria faltar num cartão, mas evita quebrar em runtime).
 */
function installmentsPreview(amount: number | null, installments: number, card: AccountDTO, purchaseDate: DateOnly): string | null {
  if (!amount || card.closingDay == null || card.dueDay == null) return null;
  const { invoiceMonth } = invoiceFor(purchaseDate, card.closingDay, card.dueDay);
  const parts = [installmentsText(amount, installments), `primeira fatura: ${formatMonthShort(invoiceMonth)}`];
  return parts.filter(Boolean).join(' · ');
}

type Props = {
  card: AccountDTO;
  amount: number | null;
  purchaseDate: DateOnly;
  installments: number;
  onInstallmentsChange: (n: number) => void;
};

/**
 * "Parcelar em" (1x a 48x) e a prévia das parcelas e da primeira fatura, quando a conta do lançamento é um
 * cartão (decisão R19). Extraído de transaction-form.tsx por tamanho.
 */
export function CardPurchaseFields({ card, amount, purchaseDate, installments, onInstallmentsChange }: Props) {
  const preview = installmentsPreview(amount, installments, card, purchaseDate);
  return (
    <Field label="Parcelar em" hint={preview ?? undefined}>
      <Select value={installments} onChange={(e) => onInstallmentsChange(Number(e.target.value))}>
        {INSTALLMENT_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}x
          </option>
        ))}
      </Select>
    </Field>
  );
}
