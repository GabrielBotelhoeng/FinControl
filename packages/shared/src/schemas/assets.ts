import { z } from 'zod';
import type { AssetSummary } from '../asset';
import { MAX_CENTS } from '../money';
import { centsSchema, dateOnlySchema, nameSchema, nonEmpty, NON_EMPTY_MESSAGE } from './common';
import type { DebtsDTO, ReportBalanceDTO } from './reports';

// ---------- Bens e patrimônio líquido (spec do sub-projeto 11) ----------

/** Tipo do bem (B4): só o ícone e o rótulo. */
export const assetKindSchema = z.enum(['property', 'vehicle', 'investment', 'receivable', 'other']);
export type AssetKind = z.infer<typeof assetKindSchema>;

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  property: 'Imóvel',
  vehicle: 'Veículo',
  investment: 'Investimento',
  receivable: 'Dinheiro a receber',
  other: 'Outro bem',
};

/** B5 e B6: data "no futuro" depende de hoje e fica no serviço (422). */
const assetDateSchema = dateOnlySchema.refine((d) => d >= '1900-01-01', 'A data precisa ser de 1900 em diante');

export const createAssetSchema = z.object({
  name: nameSchema,
  kind: assetKindSchema,
  /** Quanto vale hoje. */
  value: centsSchema,
  /** Desde quando a pessoa tem o bem; sem ela, hoje (B5). */
  since: assetDateSchema.optional(),
  /** Valor na data `since`; sem ele, o valor de hoje (B5). */
  purchaseValue: centsSchema.optional(),
});
export const updateAssetSchema = z.object({ name: nameSchema, kind: assetKindSchema }).partial().refine(nonEmpty, NON_EMPTY_MESSAGE);

/** B6: zero vale (vendeu ou perdeu o bem). */
export const assetValuationSchema = z.object({
  amount: z.number('Informe um número').int('Valor deve ser em centavos (inteiro)').min(0, 'Não pode ser negativo').max(MAX_CENTS, 'Valor acima do limite'),
  date: assetDateSchema,
});

export type CreateAssetInput = z.output<typeof createAssetSchema>;
export type UpdateAssetInput = z.output<typeof updateAssetSchema>;
export type AssetValuationInput = z.output<typeof assetValuationSchema>;

export type AssetDTO = AssetSummary & { id: string; name: string; kind: AssetKind };
export type AssetValuationDTO = { id: string; date: string; amount: number };
/** O histórico vem do mais novo ao mais antigo. */
export type AssetDetailDTO = AssetDTO & { valuations: AssetValuationDTO[] };

/** Ponto da série (B8): contas e bens somam, dívidas subtraem. */
export type NetWorthPointDTO = { month: string; date: string; accounts: number; assets: number; debts: number; total: number };

export type NetWorthDTO = {
  date: string;
  /** Contas não arquivadas, sem cartões (B1, a regra R7 do relatório). */
  accounts: { items: ReportBalanceDTO[]; total: number };
  assets: { items: AssetDTO[]; total: number };
  debts: DebtsDTO;
  total: number;
  /** Do mais antigo ao mais novo; o último ponto é hoje. */
  series: NetWorthPointDTO[];
};
