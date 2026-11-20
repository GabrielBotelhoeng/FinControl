import type { CategoryDTO } from '@fincontrol/shared';
import { describe, expect, it } from 'vitest';
import { categoryOf, categoryOptions } from './tree';

const cat = (id: string, name: string, parentId: string | null = null, type: 'expense' | 'income' = 'expense'): CategoryDTO => ({
  id, name, type, icon: 'tag', color: '#000000', parentId,
});
const list = [
  cat('lazer', 'Lazer'), cat('food', 'Alimentação'), cat('rest', 'Restaurante', 'food'), cat('market', 'Mercado', 'food'),
  cat('bar', 'Bar', 'lazer'), cat('salary', 'Salário', null, 'income'),
];

describe('árvore de categorias (sub-projeto 15)', () => {
  it('U4: cada categoria seguida das subcategorias, em ordem alfabética, só do tipo pedido', () => {
    expect(categoryOptions(list, 'expense')).toEqual([
      { id: 'food', label: 'Alimentação', depth: 0 },
      { id: 'market', label: 'Alimentação › Mercado', depth: 1 },
      { id: 'rest', label: 'Alimentação › Restaurante', depth: 1 },
      { id: 'lazer', label: 'Lazer', depth: 0 },
      { id: 'bar', label: 'Lazer › Bar', depth: 1 },
    ]);
    expect(categoryOptions(list, 'income')).toEqual([{ id: 'salary', label: 'Salário', depth: 0 }]);
  });

  it('a categoria do lançamento vem com a principal dela', () => {
    const byId = new Map(list.map((c) => [c.id, c]));
    expect(categoryOf(byId, 'rest')).toEqual({ category: list[2], parent: list[1] });
    expect(categoryOf(byId, 'food')).toEqual({ category: list[1], parent: undefined });
    expect(categoryOf(byId, null)).toEqual({ category: undefined, parent: undefined });
  });
});
