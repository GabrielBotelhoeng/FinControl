import { describe, expect, it } from 'vitest';
import { budgetStatus, goalProgress, monthsUntil, suggestedLimit } from './planning';

describe('budgetStatus (P3)', () => {
  it('critérios 1 e 2: 450 de 500 = 90% perto; 550 de 500 = 110% estourou', () => {
    expect(budgetStatus(45000, 50000)).toEqual({ percent: 90, status: 'near' });
    expect(budgetStatus(55000, 50000)).toEqual({ percent: 110, status: 'over' });
  });
  it('a faixa segue o número exibido: 79,5% aparece 80% e já está perto; 100% exato ainda é perto', () => {
    expect(budgetStatus(39750, 50000)).toEqual({ percent: 80, status: 'near' });
    expect(budgetStatus(39500, 50000)).toEqual({ percent: 79, status: 'ok' });
    expect(budgetStatus(50000, 50000)).toEqual({ percent: 100, status: 'near' });
    expect(budgetStatus(50300, 50000)).toEqual({ percent: 101, status: 'over' });
  });
  it('sem gasto é 0%, dentro', () => expect(budgetStatus(0, 50000)).toEqual({ percent: 0, status: 'ok' }));
});

describe('suggestedLimit (P4)', () => {
  it('média dos meses com gasto, para cima em R$ 10', () => {
    expect(suggestedLimit([45000, 52000, 0])).toBe(49000);
    expect(suggestedLimit([30000, 30000, 30000])).toBe(30000);
  });
  it('sem gasto não sugere', () => expect(suggestedLimit([0, 0, 0])).toBeNull());
});

describe('monthsUntil', () => {
  it('conta o mês atual e o do prazo, atravessando o ano', () => expect(monthsUntil('2026-11-16', '2027-04-30')).toBe(6));
  it('prazo no mês atual ou vencido vale 1', () => {
    expect(monthsUntil('2026-11-16', '2026-11-30')).toBe(1);
    expect(monthsUntil('2026-11-16', '2026-09-01')).toBe(1);
  });
});

describe('goalProgress (P7)', () => {
  const base = { target: 600000, createdAt: '2026-05-16', targetDate: '2027-05-16', today: '2026-11-16' };
  it('critério 4: R$ 1.500 de R$ 6.000 = 25%, atrasada (metade do prazo já passou), aporte de 7 meses', () => {
    expect(goalProgress({ ...base, saved: 150000 })).toEqual({ fraction: 0.25, status: 'late', monthlyNeeded: 64286, monthsLeft: 7 });
  });
  it('no ritmo quando o guardado acompanha o tempo decorrido', () => {
    expect(goalProgress({ ...base, saved: 320000 }).status).toBe('on_track');
  });
  it('concluída: fração limitada a 1 e nada mais a guardar', () => {
    expect(goalProgress({ ...base, saved: 700000 })).toEqual({ fraction: 1, status: 'reached', monthlyNeeded: 0, monthsLeft: 7 });
  });
  it('prazo vencido sem concluir: o restante inteiro, em 1 mês', () => {
    expect(goalProgress({ ...base, saved: 100000, today: '2027-06-01' })).toEqual({ fraction: 100000 / 600000, status: 'overdue', monthlyNeeded: 500000, monthsLeft: 1 });
  });
  it('meta criada hoje com prazo hoje não divide por zero', () => {
    expect(goalProgress({ target: 1000, saved: 0, createdAt: '2026-11-16', targetDate: '2026-11-16', today: '2026-11-16' }).monthlyNeeded).toBe(1000);
  });
});
