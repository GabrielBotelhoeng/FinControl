import { z } from 'zod';
import { MAX_CENTS } from '../money';
import { colorSchema, nameSchema, NON_EMPTY_MESSAGE, nonEmpty } from './common';

export const accountTypeSchema = z.enum(['checking', 'savings', 'wallet', 'investment', 'credit_card']);
export type AccountType = z.infer<typeof accountTypeSchema>;

const initialBalanceSchema = z.number().int('Valor deve ser em centavos (inteiro)').min(-MAX_CENTS).max(MAX_CENTS);
const fields = { name: nameSchema, type: accountTypeSchema, color: colorSchema, initialBalance: initialBalanceSchema };

export const createAccountSchema = z.object({ ...fields, initialBalance: initialBalanceSchema.default(0) });
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
};
