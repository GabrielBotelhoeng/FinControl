import { describe, expect, it } from 'vitest';
import { groupByDay } from './group-by-day';

const tx = (id: string, dueDate: string) => ({ id, dueDate });

describe('groupByDay', () => {
  it('agrupa na ordem recebida e rotula Hoje, Ontem e as demais datas por extenso', () => {
    const groups = groupByDay([tx('a', '2026-11-11'), tx('b', '2026-11-11'), tx('c', '2026-11-10'), tx('d', '2026-11-05')], '2026-11-11');
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Hoje', ['a', 'b']],
      ['Ontem', ['c']],
      ['quinta-feira, 5 de novembro', ['d']],
    ]);
  });

  it('mostra o ano quando a data é de outro ano', () => {
    expect(groupByDay([tx('a', '2025-12-31')], '2026-11-11')[0]?.label).toBe('quarta-feira, 31 de dezembro de 2025');
  });
});
