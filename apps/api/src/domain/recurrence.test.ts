import { describe, expect, it } from 'vitest';
import { nthOccurrence, occurrenceDates } from './recurrence';

describe('occurrenceDates', () => {
  it('mensal no dia 31 cai no último dia dos meses curtos e volta ao 31 depois', () => {
    expect(occurrenceDates({ frequency: 'monthly', startDate: '2026-01-31', endDate: null, until: '2026-05-31' })).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31',
    ]);
  });

  it('semanal soma 7 dias', () => {
    expect(occurrenceDates({ frequency: 'weekly', startDate: '2026-12-24', endDate: null, until: '2027-01-14' })).toEqual([
      '2026-12-24', '2026-12-31', '2027-01-07', '2027-01-14',
    ]);
  });

  it('anual em 29/02 cai em 28/02 nos anos não bissextos', () => {
    expect(occurrenceDates({ frequency: 'yearly', startDate: '2028-02-29', endDate: null, until: '2032-03-01' })).toEqual([
      '2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29',
    ]);
  });

  it('respeita a data final inclusiva', () => {
    expect(occurrenceDates({ frequency: 'monthly', startDate: '2026-01-10', endDate: '2026-03-10', until: '2026-12-31' })).toEqual([
      '2026-01-10', '2026-02-10', '2026-03-10',
    ]);
  });

  it('é vazio quando o limite é anterior ao início', () => {
    expect(occurrenceDates({ frequency: 'monthly', startDate: '2026-05-01', endDate: null, until: '2026-04-30' })).toEqual([]);
  });

  it('é vazio quando a data final é anterior ao início (série encerrada)', () => {
    expect(occurrenceDates({ frequency: 'monthly', startDate: '2026-05-01', endDate: '2026-04-30', until: '2026-12-31' })).toEqual([]);
  });

  it('nunca passa do teto de ocorrências', () => {
    expect(occurrenceDates({ frequency: 'weekly', startDate: '2000-01-01', endDate: null, until: '2100-01-01' })).toHaveLength(1000);
  });
});

describe('nthOccurrence', () => {
  it('calcula a partir do início, não da ocorrência anterior', () => {
    expect(nthOccurrence('monthly', '2026-01-31', 2)).toBe('2026-03-31');
  });
});
