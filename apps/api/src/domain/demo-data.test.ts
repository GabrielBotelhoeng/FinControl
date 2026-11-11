import { addMonthsToYm, endOfMonth, monthOf, startOfMonth } from '@fincontrol/shared';
import { describe, expect, it } from 'vitest';
import { buildDemoData } from './demo-data';

const TODAY = '2026-11-11';

describe('buildDemoData', () => {
  it('é determinístico para a mesma data', () => {
    expect(buildDemoData(TODAY)).toEqual(buildDemoData(TODAY));
  });

  it('mantém todas as datas entre 6 meses atrás e o fim do mês atual, e nada pago no futuro', () => {
    const plan = buildDemoData(TODAY);
    const min = startOfMonth(addMonthsToYm(monthOf(TODAY), -6));
    const max = endOfMonth(monthOf(TODAY));
    for (const t of plan.transactions) {
      expect(t.dueDate >= min && t.dueDate <= max).toBe(true);
      if (t.status === 'paid') expect(t.paidDate! <= TODAY).toBe(true);
      expect(Number.isInteger(t.amount) && t.amount > 0).toBe(true);
    }
  });

  it('transferências vão da corrente para a poupança, sem categoria', () => {
    const transfers = buildDemoData(TODAY).transactions.filter((t) => t.type === 'transfer');
    expect(transfers.length).toBeGreaterThan(0);
    for (const t of transfers) expect(t).toMatchObject({ accountKey: 'checking', destinationAccountKey: 'savings', categoryName: null, nature: null });
  });

  it('cada mês passado tem pelo menos 10 despesas variáveis', () => {
    const plan = buildDemoData(TODAY);
    for (let i = 1; i <= 6; i++) {
      const ym = addMonthsToYm(monthOf(TODAY), -i);
      const count = plan.transactions.filter((t) => t.type === 'expense' && t.nature === 'variable' && monthOf(t.dueDate) === ym).length;
      expect(count).toBeGreaterThanOrEqual(10);
    }
  });

  it('recorrências começam no primeiro mês do histórico', () => {
    const plan = buildDemoData(TODAY);
    expect(plan.recurrences.map((r) => r.description)).toEqual(['Salário', 'Aluguel', 'Internet', 'Streaming', 'Academia']);
    for (const r of plan.recurrences) expect(monthOf(r.startDate)).toBe('2026-05');
  });

  it('deixa um lançamento pendente no fim do mês atual', () => {
    const pending = buildDemoData(TODAY).transactions.filter((t) => t.status === 'pending');
    expect(pending).toEqual([expect.objectContaining({ description: 'IPVA (parcela)', dueDate: '2026-11-30' })]);
  });
});
