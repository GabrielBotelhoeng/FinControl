import { describe, expect, it } from 'vitest';
import { assetSummary, assetValueAt, netWorthDates, type AssetValuationEntry } from './asset';

const at = (date: string, time = '12:00') => `${date}T${time}:00.000Z`;

/** Gravados em outra ordem: o da compra, o de hoje e, por último, um do meio do caminho. */
const car: AssetValuationEntry[] = [
  { date: '2025-06-01', recordedAt: at('2026-11-19', '10:00'), amount: 4500000 },
  { date: '2026-11-19', recordedAt: at('2026-11-19', '10:01'), amount: 4000000 },
  { date: '2026-05-10', recordedAt: at('2026-11-19', '10:05'), amount: 4250000 },
];

describe('assetValueAt (B3)', () => {
  it('antes do primeiro registro o bem vale 0', () => expect(assetValueAt(car, '2025-05-31')).toBe(0));

  it('vale o registro mais recente até a data, mesmo que gravado depois', () => {
    expect(assetValueAt(car, '2025-06-01')).toBe(4500000);
    expect(assetValueAt(car, '2026-05-09')).toBe(4500000);
    expect(assetValueAt(car, '2026-05-10')).toBe(4250000);
    expect(assetValueAt(car, '2026-11-18')).toBe(4250000);
    expect(assetValueAt(car, '2026-11-19')).toBe(4000000);
  });

  it('no mesmo dia, vale o último gravado', () => {
    const sameDay = [
      { date: '2026-11-19', recordedAt: at('2026-11-19', '11:00'), amount: 100 },
      { date: '2026-11-19', recordedAt: at('2026-11-19', '09:00'), amount: 200 },
    ];
    expect(assetValueAt(sameDay, '2026-11-19')).toBe(100);
  });

  it('valor 0 (vendido) vale a partir da data, e o passado continua', () => {
    const sold = [...car, { date: '2026-11-19', recordedAt: at('2026-11-19', '12:00'), amount: 0 }];
    expect(assetValueAt(sold, '2026-11-19')).toBe(0);
    expect(assetValueAt(sold, '2026-10-31')).toBe(4250000);
  });

  it('sem registro vale 0', () => expect(assetValueAt([], '2026-11-19')).toBe(0));
});

describe('assetSummary', () => {
  it('valor de hoje, data e valor do primeiro registro e a data da última atualização', () => {
    expect(assetSummary(car, '2026-11-19')).toEqual({ value: 4000000, since: '2025-06-01', firstValue: 4500000, updatedOn: '2026-11-19' });
  });

  it('a última atualização é a de data mais recente, não a última gravada', () => {
    expect(assetSummary(car.slice(0, 1).concat(car[2]!), '2026-11-19')).toEqual({
      value: 4250000, since: '2025-06-01', firstValue: 4500000, updatedOn: '2026-05-10',
    });
  });

  it('dois registros no primeiro dia: vale o primeiro gravado', () => {
    const v = [
      { date: '2026-01-01', recordedAt: at('2026-01-01', '10:00'), amount: 700 },
      { date: '2026-01-01', recordedAt: at('2026-01-01', '09:00'), amount: 500 },
    ];
    expect(assetSummary(v, '2026-11-19')).toMatchObject({ since: '2026-01-01', firstValue: 500, value: 700 });
  });

  it('sem registro devolve null', () => expect(assetSummary([], '2026-11-19')).toBeNull());
});

describe('netWorthDates (B8)', () => {
  it('12 pontos: o fim de cada mês e, no mês atual, hoje', () => {
    const dates = netWorthDates('2026-11-19', 12);
    expect(dates).toHaveLength(12);
    expect(dates[0]).toEqual({ month: '2025-12', date: '2025-12-31' });
    expect(dates[10]).toEqual({ month: '2026-10', date: '2026-10-31' });
    expect(dates[11]).toEqual({ month: '2026-11', date: '2026-11-19' });
  });

  it('fevereiro e a virada do ano', () => {
    expect(netWorthDates('2026-03-05', 3)).toEqual([
      { month: '2026-01', date: '2026-01-31' },
      { month: '2026-02', date: '2026-02-28' },
      { month: '2026-03', date: '2026-03-05' },
    ]);
  });
});
