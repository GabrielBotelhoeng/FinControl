import { addDays, addMonthsToYm, dateInMonth, monthOf, type DateOnly, type Frequency } from '@fincontrol/shared';

export const MAX_OCCURRENCES = 1000;

/**
 * k-ésima ocorrência, calculada sempre a partir do início. Assim uma série no dia 31
 * cai em 28/02 e volta a 31/03 (spec 5.3).
 */
export function nthOccurrence(frequency: Frequency, startDate: DateOnly, k: number): DateOnly {
  if (frequency === 'weekly') return addDays(startDate, 7 * k);
  const day = Number(startDate.slice(8, 10));
  const months = frequency === 'monthly' ? k : 12 * k;
  return dateInMonth(addMonthsToYm(monthOf(startDate), months), day);
}

export function occurrenceDates(p: {
  frequency: Frequency;
  startDate: DateOnly;
  endDate: DateOnly | null;
  until: DateOnly;
}): DateOnly[] {
  const limit = p.endDate !== null && p.endDate < p.until ? p.endDate : p.until;
  const dates: DateOnly[] = [];
  for (let k = 0; k < MAX_OCCURRENCES; k++) {
    const d = nthOccurrence(p.frequency, p.startDate, k);
    if (d > limit) break;
    dates.push(d);
  }
  return dates;
}
