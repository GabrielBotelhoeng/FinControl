import type { BankDTO, LoanComparisonDTO } from '@fincontrol/shared';
import { MODALITY_BY_KIND, type BcbModality } from '../../domain/loan-modalities';
import type { BcbClient } from '../../infra/bcb-client';
import type { Logger } from '../../infra/logger';
import type { BankRatesRepository } from './bank-rates.repository';

export type SyncResult = { modality: string; status: 'updated' | 'kept'; rows: number };

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Percentual do Banco Central (1.12) → fração (0,0112), arredondada para não carregar ruído de ponto flutuante. */
const fraction = (percent: number) => Math.round(percent * 1e4) / 1e6;

export function createBankRatesService(deps: { repo: BankRatesRepository; bcb: BcbClient; logger: Logger }) {
  const modalities = Object.values(MODALITY_BY_KIND).filter((m): m is BcbModality => m !== null);

  return {
    /** Uma modalidade que falha não impede as outras e nunca apaga o que já estava guardado (spec seção 8). */
    async sync(): Promise<SyncResult[]> {
      const results: SyncResult[] = [];
      for (const m of modalities) {
        try {
          const latest = await deps.bcb.latestRates(m);
          if (!latest) {
            deps.logger.warn({ modality: m.name }, 'Banco Central sem dados para a modalidade; dados anteriores mantidos');
            results.push({ modality: m.name, status: 'kept', rows: 0 });
            continue;
          }
          const rows = await deps.repo.replace(latest);
          if (rows === 0) deps.logger.warn({ modality: m.name }, 'Nenhuma linha válida do Banco Central; dados anteriores mantidos');
          results.push({ modality: m.name, status: rows > 0 ? 'updated' : 'kept', rows });
        } catch (err) {
          deps.logger.warn({ modality: m.name, err: (err as Error).message }, 'Falha ao sincronizar taxas; dados anteriores mantidos');
          results.push({ modality: m.name, status: 'kept', rows: 0 });
        }
      }
      return results;
    },

    /** Banco (quando está na lista) e mediana do mercado (D3) no período guardado da modalidade; `null` sem dados. */
    async comparison(modality: string, cnpj8: string | null): Promise<LoanComparisonDTO | null> {
      const rows = await deps.repo.listByModality(modality);
      if (rows.length === 0) return null;
      const bank = cnpj8 ? rows.find((r) => r.cnpj8 === cnpj8) : undefined;
      return {
        modality,
        periodStart: rows[0]!.periodStart,
        periodEnd: rows[0]!.periodEnd,
        source: 'Banco Central do Brasil',
        bank: bank
          ? { name: bank.institution, monthlyRate: fraction(bank.monthlyRate), annualRate: fraction(bank.annualRate), position: bank.position, of: rows.length }
          : null,
        market: { monthlyRate: fraction(median(rows.map((r) => r.monthlyRate))), annualRate: fraction(median(rows.map((r) => r.annualRate))) },
      };
    },

    searchBanks: (q: string): Promise<BankDTO[]> => deps.repo.searchBanks(q.trim()),
  };
}

export type BankRatesService = ReturnType<typeof createBankRatesService>;
