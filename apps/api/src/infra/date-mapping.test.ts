import { describe, expect, it } from 'vitest';
import { fromDateOnly, toDateOnly } from './date-mapping';

describe('date-mapping', () => {
  it('ida e volta sem deslocar o dia', () => {
    expect(toDateOnly(fromDateOnly('2026-02-28'))).toBe('2026-02-28');
    expect(fromDateOnly('2026-11-11').toISOString()).toBe('2026-11-11T00:00:00.000Z');
  });
});
