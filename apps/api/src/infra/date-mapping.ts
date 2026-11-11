import type { DateOnly } from '@fincontrol/shared';

/** Colunas DATE chegam do Prisma como Date à meia-noite UTC. */
export const toDateOnly = (d: Date): DateOnly => d.toISOString().slice(0, 10);
export const fromDateOnly = (s: DateOnly): Date => new Date(`${s}T00:00:00.000Z`);
