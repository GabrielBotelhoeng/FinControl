import { describe, expect, it } from 'vitest';
import { MODALITY_BY_KIND } from './loan-modalities';

describe('MODALITY_BY_KIND (nomes lidos da API em 2026-11-15)', () => {
  it('fixa a modalidade de cada tipo', () => {
    expect(MODALITY_BY_KIND).toEqual({
      personal: { name: 'Crédito pessoal não consignado - Prefixado', source: 'weekly' },
      payroll_inss: { name: 'Crédito pessoal consignado INSS - Prefixado', source: 'weekly' },
      payroll_public: { name: 'Crédito pessoal consignado público - Prefixado', source: 'weekly' },
      payroll_private: { name: 'Crédito pessoal consignado privado - Prefixado', source: 'weekly' },
      vehicle: { name: 'Aquisição de veículos - Prefixado', source: 'weekly' },
      mortgage: { name: 'Financiamento imobiliário com taxas de mercado - Prefixado', source: 'monthly' },
      other: null,
    });
  });
});
