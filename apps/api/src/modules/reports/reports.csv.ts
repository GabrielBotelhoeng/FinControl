import { toCsv, type YearMonth } from '@fincontrol/shared';
import type { CsvRow } from './reports.repository';

/**
 * Sub-projetos 14 (H6) e 15 (U8): "Tags" e "Subcategoria" no fim, para as colunas antigas não mudarem de lugar.
 * "Categoria" é a principal.
 */
const HEADER = ['Data', 'Descrição', 'Tipo', 'Categoria', 'Conta', 'Conta de destino', 'Situação', 'Valor', 'Tags', 'Subcategoria'];
const TYPE_LABEL = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' } as const;
const STATUS_LABEL = { paid: 'Paga', pending: 'Pendente' } as const;

const brDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** R9: receitas positivas, despesas negativas; a transferência sai com o valor movido. */
export function transactionsCsv(rows: CsvRow[]): string {
  return toCsv(
    HEADER,
    rows.map((r) => [
      brDate(r.date), r.description, TYPE_LABEL[r.type], r.category ?? '', r.account, r.destination ?? '',
      STATUS_LABEL[r.status], r.type === 'expense' ? -r.amount : r.amount, r.tags.join(', '), r.subcategory ?? '',
    ]),
  );
}

/** R11: `AAAA-MM` para um mês; `AAAA-MM_AAAA-MM` para um intervalo. */
export function periodSlug(from: YearMonth, to: YearMonth): string {
  return from === to ? from : `${from}_${to}`;
}
