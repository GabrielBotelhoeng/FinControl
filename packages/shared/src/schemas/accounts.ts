import { z } from 'zod';
import { MAX_CENTS } from '../money';
import { centsSchema, colorSchema, dateOnlySchema, idSchema, nameSchema, NON_EMPTY_MESSAGE, nonEmpty } from './common';

export const accountTypeSchema = z.enum(['checking', 'savings', 'wallet', 'investment', 'credit_card']);
export type AccountType = z.infer<typeof accountTypeSchema>;

const initialBalanceSchema = z.number().int('Valor deve ser em centavos (inteiro)').min(-MAX_CENTS).max(MAX_CENTS);
const dayOfMonthSchema = z
  .number('Informe um número')
  .int('Dia deve ser um número inteiro')
  .min(1, 'Dia deve ser entre 1 e 31')
  .max(31, 'Dia deve ser entre 1 e 31');

const fields = {
  name: nameSchema,
  type: accountTypeSchema,
  color: colorSchema,
  initialBalance: initialBalanceSchema,
  creditLimit: centsSchema.optional(),
  closingDay: dayOfMonthSchema.optional(),
  dueDay: dayOfMonthSchema.optional(),
  paymentAccountId: idSchema.optional(),
};

export type CardFields = { creditLimit?: number | null; closingDay?: number | null; dueDay?: number | null; paymentAccountId?: string | null };

const CARD_FIELD_MESSAGES: Record<keyof CardFields, string> = {
  creditLimit: 'Informe o limite do cartão',
  closingDay: 'Informe o dia de fechamento da fatura',
  dueDay: 'Informe o dia de vencimento da fatura',
  paymentAccountId: 'Informe a conta usada para pagar a fatura',
};

/** Regras de forma do cartão: os 4 campos são exigidos só com type credit_card; em outro tipo, são proibidos (spec C2). */
export function accountCardIssues(type: AccountType, card: CardFields): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  for (const key of Object.keys(CARD_FIELD_MESSAGES) as (keyof CardFields)[]) {
    const present = card[key] !== undefined && card[key] !== null;
    if (type === 'credit_card' && !present) issues.push({ path: key, message: CARD_FIELD_MESSAGES[key] });
    else if (type !== 'credit_card' && present) issues.push({ path: key, message: 'Campo exclusivo de cartão de crédito' });
  }
  return issues;
}

export const createAccountSchema = z
  .object({ ...fields, initialBalance: initialBalanceSchema.default(0) })
  .superRefine((v, ctx) => {
    for (const issue of accountCardIssues(v.type, v)) ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
  });

export const updateAccountSchema = z.object(fields).partial().refine(nonEmpty, NON_EMPTY_MESSAGE);
export const listAccountsQuerySchema = z.object({
  includeArchived: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

export type CreateAccountInput = z.output<typeof createAccountSchema>;
export type UpdateAccountInput = z.output<typeof updateAccountSchema>;

export type AccountDTO = {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  initialBalance: number;
  balance: number;
  archivedAt: string | null;
  createdAt: string;
  creditLimit: number | null;
  closingDay: number | null;
  dueDay: number | null;
  paymentAccountId: string | null;
  card: {
    limitAvailable: number;
    openInvoice: { month: string; amount: number } | null;
    nextDue: { date: string; amount: number } | null;
  } | null;
};

/** Pagamento de fatura: sempre em dinheiro (centavos inteiros positivos), de uma conta e numa data (spec C2). */
export const payInvoiceSchema = z.object({ amount: z.int().positive(), accountId: idSchema, paidDate: dateOnlySchema });
export type PayInvoiceInput = z.output<typeof payInvoiceSchema>;

export type InvoiceDTO = {
  month: string;
  closingDate: string;
  dueDate: string;
  amount: number;
  paid: number;
  status: 'open' | 'closed' | 'paid' | 'overdue';
};
