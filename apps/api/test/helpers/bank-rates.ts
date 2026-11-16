import { readFileSync } from 'node:fs';
import { fromDateOnly } from '../../src/infra/date-mapping';
import { testDb } from './db';

type Raw = {
  InicioPeriodo?: string; FimPeriodo?: string; anoMes?: string; Modalidade: string;
  InstituicaoFinanceira: string; TaxaJurosAoMes: number; TaxaJurosAoAno: number; Posicao: number; cnpj8: string;
};

export const readFixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

/** Grava uma resposta gravada do Banco Central em `bank_rates`, do mesmo jeito que o sync grava. */
export async function seedBankRatesFromFixture(name: string, periodStart?: string, periodEnd?: string): Promise<void> {
  const rows = (JSON.parse(readFixture(name)) as { value: Raw[] }).value;
  await testDb.bankRate.createMany({
    data: rows.map((r) => ({
      modality: r.Modalidade,
      periodStart: fromDateOnly(periodStart ?? r.InicioPeriodo ?? `${r.anoMes}-01`),
      periodEnd: fromDateOnly(periodEnd ?? r.FimPeriodo ?? `${r.anoMes}-28`),
      institution: r.InstituicaoFinanceira,
      cnpj8: r.cnpj8,
      monthlyRate: r.TaxaJurosAoMes,
      annualRate: r.TaxaJurosAoAno,
      position: r.Posicao,
    })),
  });
}
