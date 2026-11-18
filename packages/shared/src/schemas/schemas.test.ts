import { describe, expect, it } from 'vitest';
import {
  centsSchema, contributionSchema, createAccountSchema, createGoalSchema, createLoanSchema, setBudgetSchema, createTransactionSchema, listInvoicesQuerySchema, listTransactionsQuerySchema,
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

describe('listInvoicesQuerySchema', () => {
  it('from e to são opcionais e aceitam AAAA-MM', () => {
    expect(listInvoicesQuerySchema.parse({})).toEqual({});
    expect(listInvoicesQuerySchema.safeParse({ from: '2026-01', to: '2026-12' }).success).toBe(true);
  });

  it('recusa mês fora do formato AAAA-MM', () => {
    expect(listInvoicesQuerySchema.safeParse({ from: '2026-13' }).success).toBe(false);
    expect(listInvoicesQuerySchema.safeParse({ to: '2026/11' }).success).toBe(false);
  });
});

describe('createLoanSchema', () => {
  const demo = {
    name: 'Financiamento do carro', kind: 'vehicle', bankName: 'BCO DO BRASIL S.A.', bankCnpj8: '00000000',
    principal: 3000000, installmentAmount: 95000, installmentsTotal: 48, installmentsPaidBefore: 6,
    firstDueDate: '2025-11-10', accountId: ACC,
  };
  it('aceita o financiamento da demo', () => expect(createLoanSchema.safeParse(demo).success).toBe(true));
  it('"já pagas" igual ao total falha no campo; total − 1 passa', () => {
    const r = createLoanSchema.safeParse({ ...demo, installmentsPaidBefore: 48 });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path.join('.'))).toContain('installmentsPaidBefore');
    expect(createLoanSchema.safeParse({ ...demo, installmentsPaidBefore: 47 }).success).toBe(true);
  });
  it('parcela zero e CNPJ curto falham', () => {
    expect(createLoanSchema.safeParse({ ...demo, installmentAmount: 0 }).success).toBe(false);
    expect(createLoanSchema.safeParse({ ...demo, bankCnpj8: '123' }).success).toBe(false);
  });
  it('"já pagas" padrão é 0 e a taxa informada é fração opcional', () => {
    const { installmentsPaidBefore: _, ...rest } = demo;
    expect(createLoanSchema.parse(rest).installmentsPaidBefore).toBe(0);
    expect(createLoanSchema.safeParse({ ...demo, informedMonthlyRate: 0.025 }).success).toBe(true);
    expect(createLoanSchema.safeParse({ ...demo, informedMonthlyRate: 2.5 }).success).toBe(false);
  });
});

describe('planejamento e metas', () => {
  it('limite precisa ser maior que zero', () => {
    expect(setBudgetSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(setBudgetSchema.safeParse({ limit: 50000 }).success).toBe(true);
  });
  it('depósito não pode ser zero; retirada é negativa', () => {
    expect(contributionSchema.safeParse({ amount: 0, date: '2026-11-10' }).success).toBe(false);
    expect(contributionSchema.safeParse({ amount: -5000, date: '2026-11-10' }).success).toBe(true);
  });
  it('meta precisa de alvo maior que zero', () => {
    expect(createGoalSchema.safeParse({ name: 'Viagem', targetAmount: 0, targetDate: '2027-04-30' }).success).toBe(false);
    expect(createGoalSchema.safeParse({ name: 'Viagem', targetAmount: 600000, targetDate: '2027-04-30' }).success).toBe(true);
  });
});

describe('reportQuerySchema (R1)', () => {
  it('aceita de 1 a 24 meses, com o fim depois do início', async () => {
    const { reportQuerySchema } = await import('./index');
    expect(reportQuerySchema.safeParse({ from: '2026-01', to: '2026-12' }).success).toBe(true);
    expect(reportQuerySchema.safeParse({ from: '2026-05', to: '2026-05' }).success).toBe(true);
    expect(paths(reportQuerySchema.safeParse({ from: '2026-05', to: '2026-04' }))).toEqual(['to']);
    expect(paths(reportQuerySchema.safeParse({ from: '2024-01', to: '2026-01' }))).toEqual(['to']);
    expect(paths(reportQuerySchema.safeParse({ from: '2026-13', to: '2026-01' }))).toEqual(['from']);
    expect(paths(reportQuerySchema.safeParse({}))).toEqual(['from', 'to']);
    expect(paths(reportQuerySchema.safeParse({ from: '0001-01', to: '0001-01' }))).toEqual(['from']);
  });
});

describe('notificações (N7)', () => {
  it('preferências exigem o objeto inteiro e antecedência de 1, 3 ou 7 dias', async () => {
    const { notificationPrefsSchema, markReadSchema, updateProfileSchema } = await import('./index');
    const ok = { bills: true, invoices: false, budget: true, goals: true, billDays: 7 };
    expect(notificationPrefsSchema.safeParse(ok).success).toBe(true);
    expect(paths(notificationPrefsSchema.safeParse({ ...ok, billDays: 5 }))).toEqual(['billDays']);
    expect(updateProfileSchema.safeParse({ notificationPrefs: ok }).success).toBe(true);
    expect(markReadSchema.safeParse({ keys: [] }).success).toBe(false);
    expect(markReadSchema.safeParse({ keys: ['due:a:2026-11-20'] }).success).toBe(true);
  });
});

describe('Web Push (W5)', () => {
  it('aceita só serviços de push conhecidos, em https e sem porta', async () => {
    const { isKnownPushEndpoint, pushSubscriptionSchema } = await import('./index');
    for (const ok of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/QGx',
      'https://wns2-by3p.notify.windows.com/w/?token=abc',
    ]) expect(isKnownPushEndpoint(ok), ok).toBe(true);
    for (const bad of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://fcm.googleapis.com:8443/x',
      'https://fcm.googleapis.com.evil.com/x',
      'https://localhost/x',
      'https://169.254.169.254/latest',
      'https://evilnotify.windows.com/x',
      'não é url',
    ]) expect(isKnownPushEndpoint(bad), bad).toBe(false);
    const keys = { p256dh: 'BPk', auth: 'aa' };
    expect(pushSubscriptionSchema.safeParse({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys }).success).toBe(true);
    expect(paths(pushSubscriptionSchema.safeParse({ endpoint: 'https://localhost/x', keys }))).toEqual(['endpoint']);
  });
});
