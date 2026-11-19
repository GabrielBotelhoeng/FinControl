import { describe, expect, it } from 'vitest';
import { impliedMonthlyRate, outstandingBalance } from './loan';
import { minimumBudget, simulatePayoff, type PayoffDebt } from './payoff';

const debts: PayoffDebt[] = [
  { id: 'a', name: 'Cheque especial', balance: 100000, monthlyRate: 0.08, minimum: 0 },
  { id: 'b', name: 'Loja', balance: 30000, monthlyRate: 0, minimum: 10000 },
  { id: 'c', name: 'Empréstimo', balance: 200000, monthlyRate: 0.02, minimum: 20000 },
];

describe('minimumBudget (Q2)', () => {
  it('soma as parcelas, limitadas ao saldo, das dívidas com saldo', () => {
    expect(minimumBudget(debts)).toBe(30000);
    expect(minimumBudget([{ id: 'x', name: 'x', balance: 5000, monthlyRate: 0, minimum: 10000 }])).toBe(5000);
  });
});

describe('simulatePayoff (Q3, Q4)', () => {
  it('avalanche quita primeiro a de maior juros e paga menos juros que a bola de neve', () => {
    const av = simulatePayoff(debts, 60000, 'avalanche', '2026-12');
    const sb = simulatePayoff(debts, 60000, 'snowball', '2026-12');
    const month = (r: typeof av, id: string) => r.order.find((o) => o.id === id)!.month!;
    // A sobra vai para o cheque especial (8%) na avalanche e para a Loja (menor saldo) na bola de neve.
    expect(month(av, 'a')).toBeLessThanOrEqual(month(sb, 'a'));
    expect(month(sb, 'b')).toBeLessThan(month(av, 'b'));
    expect(month(av, 'a')).toBeLessThan(month(av, 'c'));
    expect(av.totalInterest).toBeLessThan(sb.totalInterest);
    expect(av.months).not.toBeNull();
    expect(av.totalPaid).toBe(330000 + av.totalInterest);
  });

  it('sem juros, um mês de orçamento cheio quita e a data é o mês de início', () => {
    const r = simulatePayoff([{ id: 'x', name: 'x', balance: 50000, monthlyRate: 0, minimum: 0 }], 50000, 'snowball', '2026-12');
    expect(r).toMatchObject({ months: 1, payoffMonth: '2026-12', totalInterest: 0, totalPaid: 50000, balances: [0] });
  });

  it('a sobra de uma dívida quitada vai para a próxima no mesmo mês', () => {
    const r = simulatePayoff(
      [
        { id: 'x', name: 'x', balance: 10000, monthlyRate: 0, minimum: 0 },
        { id: 'y', name: 'y', balance: 30000, monthlyRate: 0, minimum: 0 },
      ],
      20000, 'snowball', '2026-12',
    );
    expect(r.balances).toEqual([20000, 0]);
    expect(r.order.map((o) => o.month)).toEqual([1, 2]);
  });

  it('só o mínimo: dívida com juros e sem parcela nunca acaba', () => {
    const r = simulatePayoff(debts, 0, 'minimum', '2026-12');
    expect(r.months).toBeNull();
    expect(r.payoffMonth).toBeNull();
    expect(r.order.find((o) => o.id === 'a')!.month).toBeNull();
    expect(r.order.find((o) => o.id === 'b')!.month).toBe(3);
  });

  it('juros maiores que o pagamento: não quita e para antes de virar número sem sentido', () => {
    const r = simulatePayoff([{ id: 'x', name: 'x', balance: 100000, monthlyRate: 0.1, minimum: 5000 }], 5000, 'avalanche', '2026-12');
    expect(r.months).toBeNull();
    expect(r.balances.length).toBeLessThan(600);
    expect(Number.isFinite(r.totalInterest)).toBe(true);
    const huge = simulatePayoff([{ id: 'x', name: 'x', balance: 100000, monthlyRate: 8, minimum: 0 }], 0, 'minimum', '2026-12');
    expect(huge.balances.every(Number.isFinite)).toBe(true);
  });

  it('empréstimo só com a parcela termina exatamente nas parcelas que faltam (sem centavo sobrando)', () => {
    for (const [principal, installment, n, remaining] of [[1000000, 60000, 24, 18], [3000000, 95000, 48, 36], [33333, 3333, 12, 7]] as const) {
      const rate = impliedMonthlyRate(principal, installment, n);
      const balance = outstandingBalance(installment, rate, remaining);
      const r = simulatePayoff([{ id: 'l', name: 'l', balance, monthlyRate: rate, minimum: installment }], installment, 'minimum', '2026-12');
      expect(r.months).toBe(remaining);
    }
  });

  it('o mínimo considera os juros do 1º mês quando a parcela passa do saldo', () => {
    expect(minimumBudget([{ id: 'x', name: 'x', balance: 5000, monthlyRate: 0.1, minimum: 10000 }])).toBe(5500);
  });

  it('sem dívidas: zero meses', () => {
    expect(simulatePayoff([], 1000, 'avalanche', '2026-12')).toMatchObject({ months: 0, payoffMonth: '2026-12', order: [] });
  });
});
