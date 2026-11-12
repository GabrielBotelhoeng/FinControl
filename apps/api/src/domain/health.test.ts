import { describe, expect, it } from 'vitest';
import { reserveCoverage, savingsRate } from './health';

describe('savingsRate', () => {
  it('é a parte da receita que sobrou no mês, com 3 casas', () => {
    expect(savingsRate(500000, 400000)).toBe(0.2);
    expect(savingsRate(300000, 100000)).toBe(0.667);
  });

  it('fica negativa quando se gastou mais do que entrou', () => {
    expect(savingsRate(100000, 150000)).toBe(-0.5);
  });

  it('sem receita no mês, não há taxa', () => {
    expect(savingsRate(0, 50000)).toBeNull();
  });
});

describe('reserveCoverage', () => {
  it('divide o saldo líquido pela despesa média, com 1 casa', () => {
    expect(reserveCoverage(700000, [100000, 100000, 100000])).toEqual({ months: 7, averageExpense: 100000 });
    expect(reserveCoverage(250000, [100000, 50000, 150000])).toEqual({ months: 2.5, averageExpense: 100000 });
  });

  it('ignora meses sem despesa (ex.: antes de a pessoa começar a usar o app)', () => {
    expect(reserveCoverage(300000, [0, 0, 100000])).toEqual({ months: 3, averageExpense: 100000 });
  });

  it('sem histórico de despesas, não dá para calcular', () => {
    expect(reserveCoverage(300000, [0, 0, 0])).toEqual({ months: null, averageExpense: null });
  });

  it('saldo líquido zerado ou negativo cobre 0 meses', () => {
    expect(reserveCoverage(-5000, [100000])).toEqual({ months: 0, averageExpense: 100000 });
  });
});
