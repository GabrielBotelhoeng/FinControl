import type { BankDTO } from '@fincontrol/shared';
import type { BcbPeriodRates } from '../../infra/bcb-client';
import { fromDateOnly, toDateOnly } from '../../infra/date-mapping';
import type { Db } from '../../infra/prisma';

export type BankRateRow = {
  modality: string; periodStart: string; periodEnd: string; institution: string; cnpj8: string;
  monthlyRate: number; annualRate: number; position: number;
};

export function createBankRatesRepository(db: Db) {
  return {
    /** Troca o período guardado da modalidade pelo novo, numa transação (D1: só o período mais recente). */
    async replace(p: BcbPeriodRates): Promise<void> {
      await db.$transaction([
        db.bankRate.deleteMany({ where: { modality: p.modality } }),
        db.bankRate.createMany({
          data: p.rows.map((r) => ({
            modality: p.modality, periodStart: fromDateOnly(p.periodStart), periodEnd: fromDateOnly(p.periodEnd),
            institution: r.institution, cnpj8: r.cnpj8, monthlyRate: r.monthlyRate, annualRate: r.annualRate, position: r.position,
          })),
        }),
      ]);
    },

    async listByModality(modality: string): Promise<BankRateRow[]> {
      const rows = await db.bankRate.findMany({ where: { modality }, orderBy: { position: 'asc' } });
      return rows.map((r) => ({
        modality: r.modality, periodStart: toDateOnly(r.periodStart), periodEnd: toDateOnly(r.periodEnd), institution: r.institution,
        cnpj8: r.cnpj8, monthlyRate: Number(r.monthlyRate), annualRate: Number(r.annualRate), position: r.position,
      }));
    },

    /** Instituições sem repetir (um banco aparece em várias modalidades), em ordem de nome, no máximo 20. */
    async searchBanks(q: string): Promise<BankDTO[]> {
      const rows = await db.bankRate.findMany({
        where: q ? { institution: { contains: q, mode: 'insensitive' } } : {},
        distinct: ['cnpj8'],
        orderBy: { cnpj8: 'asc' },
        select: { cnpj8: true, institution: true },
      });
      return rows
        .map((r) => ({ cnpj8: r.cnpj8, name: r.institution }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        .slice(0, 20);
    },
  };
}

export type BankRatesRepository = ReturnType<typeof createBankRatesRepository>;
