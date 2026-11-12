import { describe, expect, it } from 'vitest';
import {
  centsSchema, createAccountSchema, createTransactionSchema, listTransactionsQuerySchema,
  payInvoiceSchema, updateAccountSchema, updateTransactionSchema,
} from './index';

const ACC = '0b9f6f3a-1d2e-4c5b-8a7f-111111111111';
const ACC2 = '0b9f6f3a-1d2e-4c5b-8a7f-222222222222';
const CAT = '0b9f6f3a-1d2e-4c5b-8a7f-333333333333';

const expense = {
  type: 'expense', amount: 1990, description: 'Mercado', accountId: ACC,
  categoryId: CAT, nature: 'variable', dueDate: '2026-11-10',
};

const paths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.error?.issues.map((i) => i.path.join('.')) ?? [];

describe('centsSchema', () => {
  it('aceita só inteiros positivos dentro do limite', () => {
    expect(centsSchema.safeParse(1).success).toBe(true);
    expect(centsSchema.safeParse(0).success).toBe(false);
    expect(centsSchema.safeParse(10.5).success).toBe(false);
    expect(centsSchema.safeParse('100').success).toBe(false);
    expect(centsSchema.safeParse(100_000_000_001).success).toBe(false);
  });
});

describe('createAccountSchema / updateAccountSchema', () => {
  it('aplica saldo inicial 0 por padrão e apara o nome', () => {
    const r = createAccountSchema.parse({ name: '  Nubank ', type: 'checking', color: '#8b5cf6' });
    expect(r).toEqual({ name: 'Nubank', type: 'checking', color: '#8b5cf6', initialBalance: 0 });
  });

  it('não injeta saldo inicial no PATCH e rejeita corpo vazio', () => {
    expect(updateAccountSchema.parse({ name: 'X' })).toEqual({ name: 'X' });
    expect(updateAccountSchema.safeParse({}).success).toBe(false);
  });

  it('rejeita cor inválida', () => {
    expect(paths(createAccountSchema.safeParse({ name: 'A', type: 'wallet', color: 'red' }))).toContain('color');
  });

  it('cartão exige limite, fechamento, vencimento e conta pagadora', () => {
    const base = { name: 'Cartão', type: 'credit_card', color: '#7c3aed', initialBalance: 0 };
    expect(createAccountSchema.safeParse(base).success).toBe(false);
    expect(createAccountSchema.safeParse({ ...base, creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: '00000000-0000-4000-8000-000000000000' }).success).toBe(true);
    expect(createAccountSchema.safeParse({ ...base, creditLimit: 800000, closingDay: 32, dueDay: 5, paymentAccountId: '00000000-0000-4000-8000-000000000000' }).success).toBe(false);
  });

  it('recusa campo de cartão em conta comum', () => {
    const r = createAccountSchema.safeParse({ name: 'Carteira', type: 'wallet', color: '#000000', initialBalance: 0, creditLimit: 100000 });
    expect(paths(r)).toContain('creditLimit');
  });

  it('updateAccountSchema aceita os campos de cartão com a mesma faixa', () => {
    expect(updateAccountSchema.safeParse({ closingDay: 0 }).success).toBe(false);
    expect(updateAccountSchema.safeParse({ creditLimit: 500000, closingDay: 10, dueDay: 20, paymentAccountId: ACC }).success).toBe(true);
  });
});

describe('createTransactionSchema', () => {
  it('aceita despesa válida e aplica os padrões', () => {
    const r = createTransactionSchema.parse(expense);
    expect(r).toMatchObject({ status: 'pending', paidDate: null, destinationAccountId: null, recurrence: null });
  });

  it('exige categoria e natureza em receita/despesa', () => {
    const r = createTransactionSchema.safeParse({ ...expense, categoryId: null, nature: null });
    expect(paths(r)).toEqual(expect.arrayContaining(['categoryId', 'nature']));
  });

  it('exige destino diferente da origem em transferência e proíbe categoria', () => {
    const base = { type: 'transfer', amount: 100, description: 'Reserva', accountId: ACC, dueDate: '2026-11-10' };
    expect(paths(createTransactionSchema.safeParse(base))).toContain('destinationAccountId');
    expect(paths(createTransactionSchema.safeParse({ ...base, destinationAccountId: ACC }))).toContain('destinationAccountId');
    expect(paths(createTransactionSchema.safeParse({ ...base, destinationAccountId: ACC2, categoryId: CAT }))).toContain('categoryId');
    expect(createTransactionSchema.safeParse({ ...base, destinationAccountId: ACC2 }).success).toBe(true);
  });

  it('rejeita descrição só com espaços', () => {
    expect(paths(createTransactionSchema.safeParse({ ...expense, description: '   ' }))).toContain('description');
  });

  it('rejeita fim de recorrência antes do vencimento', () => {
    const r = createTransactionSchema.safeParse({ ...expense, recurrence: { frequency: 'monthly', endDate: '2026-11-01' } });
    expect(paths(r)).toContain('recurrence.endDate');
  });

  it('parcelamento só de 2 a 48', () => {
    const tx = { type: 'expense', amount: 120000, description: 'TV', accountId: '00000000-0000-4000-8000-000000000000', categoryId: '00000000-0000-4000-8000-000000000001', nature: 'variable', dueDate: '2026-11-10' };
    expect(createTransactionSchema.safeParse({ ...tx, installments: 10 }).success).toBe(true);
    expect(createTransactionSchema.safeParse({ ...tx, installments: 1 }).success).toBe(false);
    expect(createTransactionSchema.safeParse({ ...tx, installments: 49 }).success).toBe(false);
  });

  it('recusa parcelamento fora de despesa', () => {
    const income = { type: 'income', amount: 500000, description: 'Salário', accountId: ACC, categoryId: CAT, nature: 'fixed', dueDate: '2026-11-10', installments: 3 };
    expect(paths(createTransactionSchema.safeParse(income))).toContain('installments');
  });

  it('recusa parcelamento junto com recorrência', () => {
    const r = createTransactionSchema.safeParse({ ...expense, installments: 3, recurrence: { frequency: 'monthly' } });
    expect(paths(r)).toContain('installments');
  });
});

describe('updateTransactionSchema', () => {
  it('rejeita corpo vazio', () => {
    expect(updateTransactionSchema.safeParse({}).success).toBe(false);
  });
});

describe('listTransactionsQuerySchema', () => {
  it('converte limit da querystring e aplica o padrão 50', () => {
    expect(listTransactionsQuerySchema.parse({}).limit).toBe(50);
    expect(listTransactionsQuerySchema.parse({ limit: '10' }).limit).toBe(10);
    expect(listTransactionsQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('rejeita período invertido', () => {
    expect(listTransactionsQuerySchema.safeParse({ from: '2026-12-01', to: '2026-11-01' }).success).toBe(false);
  });
});

describe('payInvoiceSchema', () => {
  it('aceita valor inteiro positivo e recusa zero', () => {
    expect(payInvoiceSchema.safeParse({ amount: 10000, accountId: ACC, paidDate: '2026-11-10' }).success).toBe(true);
    expect(payInvoiceSchema.safeParse({ amount: 0, accountId: ACC, paidDate: '2026-11-10' }).success).toBe(false);
  });

  it('usa a mensagem em pt-BR de centsSchema para valor zero', () => {
    const r = payInvoiceSchema.safeParse({ amount: 0, accountId: ACC, paidDate: '2026-11-10' });
    expect(r.error?.issues[0]?.message).toBe('Valor deve ser maior que zero');
  });
});
