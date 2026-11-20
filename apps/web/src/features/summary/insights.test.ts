import type { BudgetMonthDTO, ReportDTO } from '@fincontrol/shared';
import { describe, expect, it } from 'vitest';
import { monthInsights } from './insights';

const cat = (name: string, total: number, previous: number) => ({ categoryId: name, name, icon: 'tag', color: '#000', total, share: 0, previous, change: previous ? (total - previous) / previous : null, subcategories: [] });

const report = (over: Partial<ReportDTO> = {}): ReportDTO => ({
  period: { from: '2026-10', to: '2026-10', months: 1, previousFrom: '2026-09', previousTo: '2026-09' },
  totals: { income: 500000, expense: 300000, net: 200000, savingsRate: 0.4, previousIncome: 500000, previousExpense: 400000, incomeChange: 0, expenseChange: -0.25 },
  expenseByCategory: [cat('Alimentação', 150000, 100000), cat('Lazer', 20000, 120000), cat('Moradia', 130000, 130000)],
  incomeByCategory: [],
  expenseByTag: [],
  monthly: [],
  debts: [
    { month: '2026-09', cards: 0, loans: 100000, others: 0, total: 100000 },
    { month: '2026-10', cards: 0, loans: 90000, others: 0, total: 90000 },
  ],
  topExpenses: [{ id: 't', date: '2026-10-05', description: 'Aluguel', category: 'Moradia', account: 'Corrente', amount: 130000 }],
  balances: { date: '2026-10-31', items: [], total: 0 },
  ...over,
});

const budget = (statuses: ('ok' | 'near' | 'over')[]) =>
  ({ items: statuses.map((status, i) => ({ name: `C${i}`, status })) }) as unknown as BudgetMonthDTO;

describe('monthInsights (M2)', () => {
  it('gastos, sobra, categoria que subiu e que caiu, maior despesa, orçamento e dívidas', () => {
    const items = monthInsights('2026-10', report(), budget(['ok', 'over']));
    expect(items.map((i) => i.id)).toEqual(['expense', 'net', 'up', 'down', 'top', 'budget', 'debts']);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId.expense).toMatchObject({ tone: 'good', detail: expect.stringMatching(/25% a menos que em setembro de 2026/) });
    expect(byId.net).toMatchObject({ tone: 'good', detail: 'Você guardou 40% do que entrou. A meta saudável é 20%.' });
    expect(byId.up!.title).toMatch(/^Alimentação subiu R\$\s*500,00$/);
    expect(byId.down!.title).toMatch(/^Lazer caiu R\$\s*1\.000,00$/);
    expect(byId.budget).toMatchObject({ tone: 'bad', title: '1 categoria estourou o limite', detail: 'C1' });
    expect(byId.debts).toMatchObject({ tone: 'good', title: expect.stringMatching(/caíram R\$\s*100,00/) });
  });

  it('gastou mais do que recebeu: "Faltou"; sem orçamento nem dívida, essas frases somem', () => {
    const items = monthInsights('2026-10', report({
      totals: { income: 100000, expense: 150000, net: -50000, savingsRate: -0.5, previousIncome: 0, previousExpense: 0, incomeChange: null, expenseChange: null },
      debts: [], expenseByCategory: [], topExpenses: [],
    }), null);
    expect(items.map((i) => i.id)).toEqual(['expense', 'net']);
    expect(items[1]).toMatchObject({ tone: 'bad', title: expect.stringMatching(/^Faltou R\$\s*500,00$/) });
  });

  it('sobrou pouco (abaixo de 20%): sem polegar para cima', () => {
    const t = { income: 500000, expense: 495000, net: 5000, savingsRate: 0.01, previousIncome: 0, previousExpense: 0, incomeChange: null, expenseChange: null };
    expect(monthInsights('2026-10', report({ totals: t }), null).find((i) => i.id === 'net')!.tone).toBe('neutral');
  });

  it('mês vazio: nenhuma frase', () => {
    const t = { income: 0, expense: 0, net: 0, savingsRate: null, previousIncome: 0, previousExpense: 0, incomeChange: null, expenseChange: null };
    expect(monthInsights('2026-10', report({ totals: t, debts: [], expenseByCategory: [], topExpenses: [] }), null)).toEqual([]);
  });
});
