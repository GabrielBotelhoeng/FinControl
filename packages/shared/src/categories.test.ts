import { describe, expect, it } from 'vitest';
import { categoryLabel, rootCategoryId } from './categories';
import { createSubcategorySchema } from './schemas';

const food = { id: 'food', name: 'Alimentação', parentId: null };
const restaurant = { id: 'rest', name: 'Restaurante', parentId: 'food' };
const byId = new Map([food, restaurant].map((c) => [c.id, c]));

describe('subcategorias (sub-projeto 15)', () => {
  it('U4: o rótulo da subcategoria leva a categoria na frente; o da categoria é só o nome', () => {
    expect(categoryLabel(restaurant, byId)).toBe('Alimentação › Restaurante');
    expect(categoryLabel(food, byId)).toBe('Alimentação');
    // Sem a categoria na lista (por exemplo, ainda carregando), fica só o nome.
    expect(categoryLabel(restaurant, new Map())).toBe('Restaurante');
  });

  it('U5: a raiz da subcategoria é a categoria; a da categoria é ela mesma', () => {
    expect(rootCategoryId(restaurant)).toBe('food');
    expect(rootCategoryId(food)).toBe('food');
  });

  it('a subcategoria nova só tem nome, aparado e obrigatório', () => {
    expect(createSubcategorySchema.parse({ name: '  Restaurante ' })).toEqual({ name: 'Restaurante' });
    expect(createSubcategorySchema.safeParse({ name: '' }).success).toBe(false);
  });
});
