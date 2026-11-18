import { describe, expect, it } from 'vitest';
import {
  aboveAverage, byDescription, byWeekday, fixedVsVariable, normalizeDescription, smallExpenses, type AnalysisExpense,
} from '../src/modules/reports/report-analysis';

const exp = (description: string, amount: number, date: string, over: Partial<AnalysisExpense> = {}): AnalysisExpense => ({
  description, amount, date, category: 'Lazer', nature: 'variable', ...over,
});

describe('normalizeDescription (E5)', () => {
  it('ignora acento, maiúsculas, espaços e o número da parcela', () => {
    expect(normalizeDescription('  Cerveja  ')).toBe('cerveja');
    expect(normalizeDescription('CERVEJA (2/3)')).toBe('cerveja');
    expect(normalizeDescription('Café da manhã')).toBe('cafe da manha');
    expect(normalizeDescription('Notebook (10/12)')).toBe('notebook');
  });
});

describe('byDescription (E5)', () => {
  it('critério 1: "Cerveja" 3 vezes e "cerveja (2/3)" viram uma linha com 4 vezes', () => {
    const rows = byDescription([
      exp('Cerveja', 2000, '2026-11-01'),
      exp('Cerveja', 3000, '2026-11-08'),
      exp('cerveja (2/3)', 1500, '2026-11-20'),
      exp('Cerveja', 2500, '2026-11-15'),
      exp('Mercado', 50000, '2026-11-03', { category: 'Alimentação' }),
    ]);
    expect(rows[0]).toMatchObject({ label: 'Mercado', count: 1, total: 50000 });
    expect(rows[1]).toEqual({ label: 'Cerveja', count: 4, total: 9000, average: 2250, category: 'Lazer', lastDate: '2026-11-20' });
  });
  it('limita a 50 linhas, pelo total', () => {
    const many = Array.from({ length: 60 }, (_, i) => exp(`Item ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26)}`, 100 + i, '2026-11-01'));
    const rows = byDescription(many);
    expect(rows).toHaveLength(50);
    expect(rows[0]!.total).toBe(159);
  });
});

describe('byWeekday (E7)', () => {
  it('total, quantidade e média por dia; fim de semana pela média diária', () => {
    // Novembro de 2026: 1º é domingo. Período inteiro do mês: 30 dias, 9 de fim de semana e 21 úteis.
    const r = byWeekday([exp('Bar', 6000, '2026-11-07'), exp('Bar', 3000, '2026-11-08'), exp('Almoço', 4200, '2026-11-10')], '2026-11-01', '2026-11-30');
    expect(r.days.map((d) => d.weekday)).toEqual(['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']);
    expect(r.days[6]).toEqual({ weekday: 'Sábado', count: 1, total: 6000, average: 6000 });
    expect(r.days[2]).toMatchObject({ weekday: 'Terça', count: 1, total: 4200 });
    expect(r.weekend).toEqual({ total: 9000, days: 9, perDay: 1000 });
    expect(r.weekdays).toEqual({ total: 4200, days: 21, perDay: 200 });
  });
});

describe('smallExpenses (E8)', () => {
  it('soma o que é abaixo de R$ 50 por categoria, com a média por mês', () => {
    const r = smallExpenses(
      [exp('Café', 800, '2026-11-01', { category: 'Alimentação' }), exp('Café', 900, '2026-11-02', { category: 'Alimentação' }), exp('Uber', 4999, '2026-11-03', { category: 'Transporte' }), exp('Bar', 5000, '2026-11-04')],
      2,
    );
    expect(r.items).toEqual([
      { category: 'Transporte', count: 1, total: 4999 },
      { category: 'Alimentação', count: 2, total: 1700 },
    ]);
    expect(r).toMatchObject({ count: 3, total: 6699, perMonth: 3350 });
  });
});

describe('fixedVsVariable (E9)', () => {
  it('soma por natureza, com a participação', () => {
    const r = fixedVsVariable([exp('Aluguel', 150000, '2026-11-01', { nature: 'fixed' }), exp('Bar', 50000, '2026-11-02'), exp('Outro', 0, '2026-11-02', { nature: null })]);
    expect(r).toEqual([
      { nature: 'Fixas', total: 150000, share: 0.75 },
      { nature: 'Variáveis', total: 50000, share: 0.25 },
      { nature: 'Sem natureza', total: 0, share: 0 },
    ]);
  });
});

describe('aboveAverage (E6)', () => {
  it('média mensal do período contra a dos 3 meses anteriores, do maior gasto ao menor; acima de 20% é destaque', () => {
    const r = aboveAverage(new Map([['Lazer', 60000], ['Mercado', 100000], ['Nova', 5000]]), new Map([['Lazer', 90000], ['Mercado', 300000], ['Antiga', 3000]]), 1);
    expect(r).toEqual([
      { category: 'Mercado', monthly: 100000, previousMonthly: 100000, change: 0, highlight: false },
      { category: 'Lazer', monthly: 60000, previousMonthly: 30000, change: 1, highlight: true },
      { category: 'Nova', monthly: 5000, previousMonthly: 0, change: null, highlight: false },
      { category: 'Antiga', monthly: 0, previousMonthly: 1000, change: -1, highlight: false },
    ]);
  });
});
