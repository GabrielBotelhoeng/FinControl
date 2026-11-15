/** Tipos de empréstimo (D2). Trocado pelo `LoanKind` de `@fincontrol/shared` na Tarefa 3. */
type LoanKind = 'personal' | 'payroll_inss' | 'payroll_public' | 'payroll_private' | 'vehicle' | 'mortgage' | 'other';

/** Modalidade do Banco Central e de onde ela vem: `weekly` = `TaxasJurosDiariaPorInicioPeriodo`; `monthly` = `TaxasJurosMensalPorMes` (D1). */
export type BcbModality = { name: string; source: 'weekly' | 'monthly' };

/** Nomes exatos lidos da API em 2026-11-15 (spec, seção 5). `other` não tem comparação. */
export const MODALITY_BY_KIND: Record<LoanKind, BcbModality | null> = {
  personal: { name: 'Crédito pessoal não consignado - Prefixado', source: 'weekly' },
  payroll_inss: { name: 'Crédito pessoal consignado INSS - Prefixado', source: 'weekly' },
  payroll_public: { name: 'Crédito pessoal consignado público - Prefixado', source: 'weekly' },
  payroll_private: { name: 'Crédito pessoal consignado privado - Prefixado', source: 'weekly' },
  vehicle: { name: 'Aquisição de veículos - Prefixado', source: 'weekly' },
  mortgage: { name: 'Financiamento imobiliário com taxas de mercado - Prefixado', source: 'monthly' },
  other: null,
};
