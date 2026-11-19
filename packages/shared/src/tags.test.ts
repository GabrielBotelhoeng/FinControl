import { describe, expect, it } from 'vitest';
import { createTransactionSchema, listTransactionsQuerySchema, tagSchema, tagsSchema, updateTransactionSchema } from './index';
import { normalizeTag } from './tags';

const ACC = '0b9f6f3a-1d2e-4c5b-8a7f-111111111111';
const CAT = '0b9f6f3a-1d2e-4c5b-8a7f-333333333333';

describe('normalizeTag (T2)', () => {
  it('tira o "#", apara, junta espaços e põe em minúsculas, mantendo acentos', () => {
    expect(normalizeTag('  #Bebida   Alcoólica ')).toBe('bebida alcoólica');
    expect(normalizeTag('##Viagem_2026')).toBe('viagem_2026');
    expect(normalizeTag('NATAL')).toBe('natal');
  });
});

describe('tagSchema e tagsSchema (T1, T2)', () => {
  it('aceita letras, números, espaço, hífen e sublinhado, até 30 caracteres', () => {
    expect(tagSchema.parse('Férias-de-Verão')).toBe('férias-de-verão');
    expect(tagSchema.safeParse('a'.repeat(31)).success).toBe(false);
    expect(tagSchema.safeParse('#').success).toBe(false);
    expect(tagSchema.safeParse('bar/balada').success).toBe(false);
    expect(tagSchema.safeParse('cerveja 🍺').success).toBe(false);
  });

  it('a lista tira as repetidas e fica em ordem alfabética; no máximo 10', () => {
    expect(tagsSchema.parse(['Viagem', '#bebida', 'viagem', 'Açaí'])).toEqual(['açaí', 'bebida', 'viagem']);
    expect(tagsSchema.safeParse(Array.from({ length: 11 }, (_, i) => `t${i}`)).success).toBe(false);
    expect(tagsSchema.parse([])).toEqual([]);
  });

  it('lançamento: sem tags vira lista vazia; a edição e o filtro normalizam', () => {
    const base = { type: 'expense', amount: 100, description: 'Cerveja', accountId: ACC, categoryId: CAT, nature: 'variable', dueDate: '2026-11-10' };
    expect(createTransactionSchema.parse(base).tags).toEqual([]);
    expect(createTransactionSchema.parse({ ...base, tags: ['#Bebida'] }).tags).toEqual(['bebida']);
    expect(updateTransactionSchema.parse({ tags: ['Bar', 'bar'] })).toEqual({ tags: ['bar'] });
    expect(listTransactionsQuerySchema.parse({ tag: '#Bebida' }).tag).toBe('bebida');
  });
});
