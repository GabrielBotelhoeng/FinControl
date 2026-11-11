import { describe, expect, it } from 'vitest';
import { computeBalance, computeForecast, percentChange, ZERO_FLOWS } from './balance';

describe('computeBalance', () => {
  it('saldo inicial + receitas − despesas + transferências recebidas − enviadas', () => {
    expect(computeBalance(10000, { incomePaid: 5000, expensePaid: 2000, transferInPaid: 300, transferOutPaid: 1000 })).toBe(12300);
  });

  it('sem movimentos é o saldo inicial, inclusive negativo', () => {
    expect(computeBalance(-500, ZERO_FLOWS)).toBe(-500);
  });
});

describe('computeForecast', () => {
  it('soma receitas pendentes e subtrai despesas pendentes', () => {
    expect(computeForecast(100000, 5000, 30000)).toBe(75000);
  });
});

describe('percentChange', () => {
  it.each([
    [150, 100, 50],
    [50, 100, -50],
    [1, 3, -66.7],
    [100, 100, 0],
  ])('%i contra %i = %d%%', (cur, prev, expected) => {
    expect(percentChange(cur, prev)).toBe(expected);
  });

  it('é null quando o mês anterior é zero', () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});
