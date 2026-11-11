import { describe, expect, it } from 'vitest';
import { formatBRL, parseBRLToCents } from './money';

const plain = (s: string) => s.replace(/\u00a0/g, ' ');

describe('formatBRL', () => {
  it('formata centavos em reais no padrão pt-BR', () => {
    expect(plain(formatBRL(123456))).toBe('R$ 1.234,56');
    expect(plain(formatBRL(0))).toBe('R$ 0,00');
    expect(plain(formatBRL(5))).toBe('R$ 0,05');
  });

  it('formata valores negativos', () => {
    expect(plain(formatBRL(-1050))).toBe('-R$ 10,50');
  });
});

describe('parseBRLToCents', () => {
  it.each([
    ['1.234,56', 123456],
    ['R$ 12,3', 1230],
    ['10', 1000],
    ['0,05', 5],
    ['-0,50', -50],
    ['1.000.000', 100000000],
  ])('converte %s em %i centavos', (input, expected) => {
    expect(parseBRLToCents(input)).toBe(expected);
  });

  it.each(['', 'abc', '1,234', '1.23,00', '12,345', '1..0'])('rejeita %s', (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });
});
