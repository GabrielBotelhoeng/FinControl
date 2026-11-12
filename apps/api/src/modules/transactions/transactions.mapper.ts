import type { DateOnly, TransactionDTO } from '@fincontrol/shared';
import type { TransactionRow } from './transactions.repository';

export function toTransactionDTO(row: TransactionRow, today: DateOnly): TransactionDTO {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    accountId: row.accountId,
    destinationAccountId: row.destinationAccountId,
    categoryId: row.categoryId,
    nature: row.nature,
    status: row.status,
    dueDate: row.dueDate,
    paidDate: row.paidDate,
    recurrenceId: row.recurrenceId,
    occurrenceDate: row.occurrenceDate,
    invoiceMonth: row.invoiceMonth,
    installmentNumber: row.installmentNumber,
    installmentTotal: row.installmentTotal,
    overdue: row.status === 'pending' && row.dueDate < today,
    createdAt: row.createdAt.toISOString(),
  };
}
