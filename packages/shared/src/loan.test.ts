import { describe, expect, it } from 'vitest';
import { annualRate, impliedMonthlyRate, loanSummary, loanWarnings, outstandingBalance } from './loan';

describe('impliedMonthlyRate', () => {
  it('R$ 10.000 em 24x de R$ 600 → 3,15% a.m. (critério de aceite 4)', () => {
    expect(impliedMonthlyRate(1000000, 60000, 24)).toBeCloseTo(0.03149127, 7);
  });
  it('R$ 30.000 em 48x de R$ 950 → 1,858% a.m.', () => {
    expect(impliedMonthlyRate(3000000, 95000, 48)).toBeCloseTo(0.0185795, 6);
  });
  it('parcela × n ≤ valor recebido → taxa 0, sem divisão por zero', () => {
    expect(impliedMonthlyRate(100000, 1000, 100)).toBe(0);
    expect(impliedMonthlyRate(100000, 900, 100)).toBe(0);
  });
});

describe('annualRate', () => {
  it('é (1+i)^12 − 1', () => expect(annualRate(0.0185795)).toBeCloseTo(0.247209, 5));
});

describe('outstandingBalance', () => {
  it('valor presente das restantes à taxa real', () => {
    expect(outstandingBalance(95000, impliedMonthlyRate(3000000, 95000, 48), 36)).toBe(2477608);
  });
  it('taxa 0 → parcela × restantes', () => expect(outstandingBalance(1000, 0, 7)).toBe(7000));
  it('nenhuma restante → 0', () => expect(outstandingBalance(95000, 0.02, 0)).toBe(0));
});

describe('loanSummary', () => {
  it('critério 4: total R$ 14.400 e juros R$ 4.400', () => {
    const s = loanSummary({ principal: 1000000, installmentAmount: 60000, installmentsTotal: 24, installmentsPaid: 0 });
    expect(s).toMatchObject({ totalCost: 1440000, interest: 440000, paidAmount: 0, remainingCount: 24, outstanding: 1000000 });
    expect(Math.round(s.monthlyRate * 10000) / 100).toBe(3.15); // "3,15% ao mês" com 2 casas
  });
  it('critério 5: 12 de 48 pagas → saldo devedor e economia na quitação', () => {
    const s = loanSummary({ principal: 3000000, installmentAmount: 95000, installmentsTotal: 48, installmentsPaid: 12 });
    expect(s).toMatchObject({ paidAmount: 1140000, remainingCount: 36, outstanding: 2477608, payoffSavings: 942392 });
  });
});

describe('loanWarnings', () => {
  it('taxa informada difere mais de 0,1 p.p. ao mês', () => {
    expect(loanWarnings({ monthlyRate: 0.0315, informedMonthlyRate: 0.0299, kind: 'personal' })).toEqual(['informed_rate_differs']);
    expect(loanWarnings({ monthlyRate: 0.0315, informedMonthlyRate: 0.0310, kind: 'personal' })).toEqual([]);
  });
  it('acima de 30% ao mês sugere erro de digitação', () => {
    expect(loanWarnings({ monthlyRate: 0.31, informedMonthlyRate: null, kind: 'personal' })).toEqual(['rate_too_high']);
  });
  it('financiamento imobiliário avisa que a taxa é aproximada (C9, SAC)', () => {
    expect(loanWarnings({ monthlyRate: 0.009, informedMonthlyRate: null, kind: 'mortgage' })).toEqual(['sac_approximate']);
  });
});
