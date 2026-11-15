import { endOfMonth, startOfMonth, type DateOnly } from '@fincontrol/shared';
import type { BcbModality } from '../domain/loan-modalities';

const BASE = 'https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/';

/** Taxas de um período, em percentual, como o Banco Central publica (1.12 = 1,12% ao mês). */
export type BcbRateRow = { cnpj8: string; institution: string; monthlyRate: number; annualRate: number; position: number };
export type BcbPeriodRates = { modality: string; periodStart: DateOnly; periodEnd: DateOnly; rows: BcbRateRow[] };

type RawRow = { InstituicaoFinanceira: string; TaxaJurosAoMes: number; TaxaJurosAoAno: number; Posicao: number; cnpj8: string };

/** Cliente da API Olinda `taxaJuros` v2 (spec C12, D1). O `fetch` é injetado para os testes não usarem rede. */
export function createBcbClient(fetchFn: typeof fetch = fetch) {
  async function get<T>(entity: string, query: Record<string, string>): Promise<T[]> {
    // encodeURIComponent: espaço vira %20. Com "+" (URLSearchParams), a API responde "The URI is malformed".
    const qs = Object.entries({ $format: 'json', ...query })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const res = await fetchFn(`${BASE}${entity}?${qs}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Banco Central respondeu ${res.status}`);
    return ((await res.json()) as { value: T[] }).value;
  }

  const toRow = (r: RawRow): BcbRateRow => ({
    cnpj8: r.cnpj8, institution: r.InstituicaoFinanceira, monthlyRate: r.TaxaJurosAoMes, annualRate: r.TaxaJurosAoAno, position: r.Posicao,
  });

  return {
    /** O período mais recente da modalidade; `null` quando a API não tem dados. */
    async latestRates(m: BcbModality): Promise<BcbPeriodRates | null> {
      const byName = `Modalidade eq '${m.name}'`;
      if (m.source === 'weekly') {
        const entity = 'TaxasJurosDiariaPorInicioPeriodo';
        const [latest] = await get<{ InicioPeriodo: string; FimPeriodo: string }>(entity, {
          $filter: byName, $orderby: 'InicioPeriodo desc', $top: '1', $select: 'InicioPeriodo,FimPeriodo',
        });
        if (!latest) return null;
        const rows = await get<RawRow>(entity, { $filter: `${byName} and InicioPeriodo eq '${latest.InicioPeriodo}'`, $top: '500' });
        return rows.length ? { modality: m.name, periodStart: latest.InicioPeriodo, periodEnd: latest.FimPeriodo, rows: rows.map(toRow) } : null;
      }
      const entity = 'TaxasJurosMensalPorMes';
      const [latest] = await get<{ anoMes: string }>(entity, { $filter: byName, $orderby: 'anoMes desc', $top: '1', $select: 'anoMes' });
      if (!latest) return null;
      const rows = await get<RawRow>(entity, { $filter: `${byName} and anoMes eq '${latest.anoMes}'`, $top: '500' });
      return rows.length ? { modality: m.name, periodStart: startOfMonth(latest.anoMes), periodEnd: endOfMonth(latest.anoMes), rows: rows.map(toRow) } : null;
    },
  };
}

export type BcbClient = ReturnType<typeof createBcbClient>;
