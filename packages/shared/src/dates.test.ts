import { describe, expect, it } from 'vitest';
import {
  addDays, addMonthsToYm, dateInMonth, daysInMonth, endOfMonth, isValidDateOnly,
  maxDate, minDate, monthOf, startOfMonth, todayInSaoPaulo,
} from './dates';

describe('todayInSaoPaulo', () => {
  it('usa o fuso de São Paulo, não o UTC', () => {
    expect(todayInSaoPaulo(new Date('2026-11-11T02:30:00Z'))).toBe('2026-11-10');
    expect(todayInSaoPaulo(new Date('2026-11-11T15:00:00Z'))).toBe('2026-11-11');
  });
});

describe('isValidDateOnly', () => {
  it.each(['2026-02-28', '2028-02-29'])('aceita %s', (d) => expect(isValidDateOnly(d)).toBe(true));
  it.each(['2026-02-30', '2026-13-01', '26-01-01', '2026-1-1', ''])('rejeita %s', (d) =>
    expect(isValidDateOnly(d)).toBe(false));
});

describe('aritmética de datas', () => {
  it('soma dias atravessando meses e anos bissextos', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('calcula início e fim de mês', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(startOfMonth('2026-11')).toBe('2026-11-01');
    expect(endOfMonth('2026-02')).toBe('2026-02-28');
    expect(endOfMonth('2026-12')).toBe('2026-12-31');
    expect(monthOf('2026-11-11')).toBe('2026-11');
  });

  it('soma meses a um ano-mês', () => {
    expect(addMonthsToYm('2026-11', 3)).toBe('2027-02');
    expect(addMonthsToYm('2026-01', -1)).toBe('2025-12');
    expect(addMonthsToYm('2026-06', -18)).toBe('2024-12');
  });

  it('limita o dia ao último dia do mês', () => {
    expect(dateInMonth('2026-02', 31)).toBe('2026-02-28');
    expect(dateInMonth('2026-04', 31)).toBe('2026-04-30');
    expect(dateInMonth('2026-05', 5)).toBe('2026-05-05');
  });

  it('compara datas', () => {
    expect(minDate('2026-01-02', '2026-01-01')).toBe('2026-01-01');
    expect(maxDate('2026-01-02', '2026-01-01')).toBe('2026-01-02');
  });
});
