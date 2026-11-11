import { addDays, type DateOnly } from '@fincontrol/shared';

const sameYear = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const otherYear = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function dayLabel(date: DateOnly, today: DateOnly): string {
  if (date === today) return 'Hoje';
  if (date === addDays(today, -1)) return 'Ontem';
  if (date === addDays(today, 1)) return 'Amanhã';
  const formatter = date.slice(0, 4) === today.slice(0, 4) ? sameYear : otherYear;
  return formatter.format(new Date(`${date}T00:00:00Z`));
}

/** Agrupa itens já ordenados por data, preservando a ordem. */
export function groupByDay<T extends { dueDate: DateOnly }>(items: T[], today: DateOnly) {
  const groups: { date: DateOnly; label: string; items: T[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.date === item.dueDate) last.items.push(item);
    else groups.push({ date: item.dueDate, label: dayLabel(item.dueDate, today), items: [item] });
  }
  return groups;
}
