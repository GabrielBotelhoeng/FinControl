import { toCsv, type YearMonth } from '@fincontrol/shared';
import type { CsvRow } from './reports.repository';

/** Sub-projeto 14 (H6): "Tags" no fim, para as colunas antigas não mudarem de lugar. */
const HEADER = ['Data', 'Descrição', 'Tipo', 'Categoria', 'Conta', 'Conta de destino', 'Situação', 'Valor', 'Tags'];
const TYPE_LABEL = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' } as const;
const STATUS_LABEL = { paid: 'Paga', pending: 'Pendente' } as const;

const brDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** R9: receitas positivas, despesas negativas; a transferência sai com o valor movido. */
export function transactionsCsv(rows: CsvRow[]): string {
  return toCsv(
    HEADER,
    rows.map((r) => [
      brDate(r.date), r.description, TYPE_LABEL[r.type], r.category ?? '', r.account, r.destination ?? '',
      STATUS_LABEL[r.status], r.type === 'expense' ? -r.amount : r.amount, r.tags.join(', '),
    ]),
  );
}

/** R11: `AAAA-MM` para um mês; `AAAA-MM_AAAA-MM` para um intervalo. */
export function periodSlug(from: YearMonth, to: YearMonth): string {
  return from === to ? from : `${from}_${to}`;
}
