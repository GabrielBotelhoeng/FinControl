import { z } from 'zod';
import { centsSchema, dateOnlySchema, idSchema, NON_EMPTY_MESSAGE, nonEmpty } from './common';

export const transactionTypeSchema = z.enum(['income', 'expense', 'transfer']);
export const natureSchema = z.enum(['fixed', 'variable']);
export const statusSchema = z.enum(['pending', 'paid']);
export const frequencySchema = z.enum(['weekly', 'monthly', 'yearly']);
export const scopeQuerySchema = z.object({ scope: z.enum(['single', 'future']).default('single') });

export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type TransactionNature = z.infer<typeof natureSchema>;
export type TransactionStatus = z.infer<typeof statusSchema>;
export type Frequency = z.infer<typeof frequencySchema>;
export type Scope = z.output<typeof scopeQuerySchema>['scope'];

export type FieldIssue = { path: string; message: string };
export type ShapeInput = {
  type: TransactionType;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  nature: TransactionNature | null;
};

/** Regras de forma que dependem do tipo. É usada no schema e, no PATCH, pelo service, sobre o objeto mesclado. */
export function transactionShapeIssues(t: ShapeInput): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (t.type === 'transfer') {
    if (!t.destinationAccountId) issues.push({ path: 'destinationAccountId', message: 'Informe a conta de destino' });
    else if (t.destinationAccountId === t.accountId)
      issues.push({ path: 'destinationAccountId', message: 'A conta de destino deve ser diferente da origem' });
    if (t.categoryId) issues.push({ path: 'categoryId', message: 'Transferência não tem categoria' });
    if (t.nature) issues.push({ path: 'nature', message: 'Transferência não tem natureza' });
  } else {
    if (!t.categoryId) issues.push({ path: 'categoryId', message: 'Informe a categoria' });
    if (!t.nature) issues.push({ path: 'nature', message: 'Informe se é fixa ou variável' });
    if (t.destinationAccountId) issues.push({ path: 'destinationAccountId', message: 'Só transferências têm conta de destino' });
  }
  return issues;
}

const descriptionSchema = z.string().trim().min(1, 'Obrigatório').max(120, 'Máximo de 120 caracteres');
const recurrenceSchema = z.object({ frequency: frequencySchema, endDate: dateOnlySchema.nullable().default(null) });
const installmentsSchema = z
  .number('Informe um número')
  .int('Quantidade de parcelas deve ser um número inteiro')
  .min(2, 'Parcelamento deve ser de 2 a 48 vezes')
  .max(48, 'Parcelamento deve ser de 2 a 48 vezes');

export const createTransactionSchema = z
  .object({
    type: transactionTypeSchema,
    amount: centsSchema,
    description: descriptionSchema,
    accountId: idSchema,
    destinationAccountId: idSchema.nullable().default(null),
    categoryId: idSchema.nullable().default(null),
    nature: natureSchema.nullable().default(null),
    status: statusSchema.default('pending'),
    dueDate: dateOnlySchema,
    paidDate: dateOnlySchema.nullable().default(null),
    recurrence: recurrenceSchema.nullable().default(null),
    installments: installmentsSchema.optional(),
  })
  .superRefine((v, ctx) => {
    for (const issue of transactionShapeIssues(v)) ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
    if (v.recurrence?.endDate && v.recurrence.endDate < v.dueDate)
      ctx.addIssue({ code: 'custom', path: ['recurrence', 'endDate'], message: 'O fim da recorrência deve ser depois do vencimento' });
    if (v.installments !== undefined) {
      if (v.type !== 'expense') ctx.addIssue({ code: 'custom', path: ['installments'], message: 'Parcelamento só é permitido em despesas' });
      if (v.recurrence) ctx.addIssue({ code: 'custom', path: ['installments'], message: 'Parcelamento não combina com recorrência' });
    }
  });

export const updateTransactionSchema = z
  .object({
    amount: centsSchema,
    description: descriptionSchema,
    accountId: idSchema,
    destinationAccountId: idSchema.nullable(),
    categoryId: idSchema.nullable(),
    nature: natureSchema.nullable(),
    dueDate: dateOnlySchema,
    recurrence: recurrenceSchema,
  })
  .partial()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);

export const listTransactionsQuerySchema = z
  .object({
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    accountId: idSchema.optional(),
    categoryId: idSchema.optional(),
    type: transactionTypeSchema.optional(),
    status: statusSchema.optional(),
    q: z.string().trim().min(1).max(100).optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { path: ['to'], message: 'O fim do período deve ser depois do início' });

export const paySchema = z.object({ paidDate: dateOnlySchema.optional() });

export type CreateTransactionInput = z.output<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.output<typeof updateTransactionSchema>;
export type ListTransactionsQuery = z.output<typeof listTransactionsQuerySchema>;

export type TransactionDTO = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  nature: TransactionNature | null;
  status: TransactionStatus;
  dueDate: string;
  paidDate: string | null;
  recurrenceId: string | null;
  occurrenceDate: string | null;
  invoiceMonth: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  overdue: boolean;
  createdAt: string;
};

export type TransactionPage = { items: TransactionDTO[]; nextCursor: string | null };
