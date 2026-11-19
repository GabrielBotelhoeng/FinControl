import { describe, expect, it } from 'vitest';
import { detectRepeatedSpending } from './subscriptions';

const pay = (description: string, amount: number, date: string, recurring = false) => ({ description, amount, date, recurring });

describe('detectRepeatedSpending (S1, S2)', () => {
  it('acha o que se repete em 3 meses com valor parecido, do mais caro ao mais barato', () => {
    const r = detectRepeatedSpending([
      pay('NETFLIX.COM 123', 3990, '2026-08-05'), pay('Netflix.com 456', 3990, '2026-09-05'), pay('NETFLIX.COM', 4490, '2026-10-05'),
      pay('Academia', 9900, '2026-08-10', true), pay('Academia', 9900, '2026-09-10', true), pay('Academia', 9900, '2026-10-10', true),
      pay('Mercado', 30000, '2026-08-01'), pay('Mercado', 12000, '2026-09-01'), pay('Mercado', 45000, '2026-10-01'),
      pay('Padaria', 1500, '2026-10-01'), pay('Padaria', 1500, '2026-10-02'), pay('Padaria', 1500, '2026-10-03'),
      pay('Spotify', 2190, '2026-09-01'), pay('Spotify', 2190, '2026-10-01'),
    ]);
    expect(r.map((x) => x.description)).toEqual(['Academia', 'NETFLIX.COM']);
    expect(r[1]).toMatchObject({ monthly: 4157, yearly: 49884, months: 3, lastDate: '2026-10-05', nextDate: '2026-11-04', recurring: false });
    expect(r[0]!.recurring).toBe(true);
  });
});
