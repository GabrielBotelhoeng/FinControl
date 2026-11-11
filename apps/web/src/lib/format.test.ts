import { describe, expect, it } from 'vitest';
import { formatDate, formatMonthLabel, formatSignedBRL, splitBRL } from './format';

const plain = (s: string) => s.replace(/ /g, ' ');

describe('formatadores pt-BR', () => {
  it('formata data sem hora', () => {
    expect(formatDate('2026-11-11')).toBe('11/11/2026');
  });

  it('formata o rótulo do mês', () => {
    expect(formatMonthLabel('2026-11')).toBe('novembro de 2026');
  });

  it('aplica sinal por tipo de lançamento', () => {
    expect(plain(formatSignedBRL(1050, 'income'))).toBe('+R$ 10,50');
    expect(plain(formatSignedBRL(1050, 'expense'))).toBe('−R$ 10,50');
    expect(plain(formatSignedBRL(1050, 'transfer'))).toBe('R$ 10,50');
  });

  it('separa moeda, inteiros e centavos para o saldo herói', () => {
    expect(splitBRL(1248050)).toEqual({ sign: '', currency: 'R$', integer: '12.480', cents: ',50' });
    expect(splitBRL(-5)).toEqual({ sign: '−', currency: 'R$', integer: '0', cents: ',05' });
  });
});
