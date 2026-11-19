import { describe, expect, it } from 'vitest';
import { assetValuationSchema, createAssetSchema, updateAssetSchema } from './index';

describe('bens (B5 e B6)', () => {
  it('cadastro: nome aparado, valor de hoje obrigatório, data e valor na compra opcionais', () => {
    expect(createAssetSchema.parse({ name: ' Carro ', kind: 'vehicle', value: 4000000 })).toEqual({ name: 'Carro', kind: 'vehicle', value: 4000000 });
    expect(createAssetSchema.safeParse({ name: 'Carro', kind: 'vehicle', value: 4000000, since: '2025-06-01', purchaseValue: 4500000 }).success).toBe(true);
    expect(createAssetSchema.safeParse({ name: 'Carro', kind: 'vehicle', value: 0 }).success).toBe(false);
    expect(createAssetSchema.safeParse({ name: 'Carro', kind: 'barco', value: 100 }).success).toBe(false);
    expect(createAssetSchema.safeParse({ name: '', kind: 'other', value: 100 }).success).toBe(false);
  });

  it('datas antes de 1900 ou inválidas não passam', () => {
    expect(createAssetSchema.safeParse({ name: 'Casa', kind: 'property', value: 100, since: '1899-12-31' }).success).toBe(false);
    expect(createAssetSchema.safeParse({ name: 'Casa', kind: 'property', value: 100, since: '1900-01-01' }).success).toBe(true);
    expect(assetValuationSchema.safeParse({ amount: 100, date: '2026-02-30' }).success).toBe(false);
  });

  it('atualizar valor aceita zero (vendeu) e recusa negativo', () => {
    expect(assetValuationSchema.safeParse({ amount: 0, date: '2026-11-19' }).success).toBe(true);
    expect(assetValuationSchema.safeParse({ amount: -1, date: '2026-11-19' }).success).toBe(false);
    expect(assetValuationSchema.safeParse({ amount: 10.5, date: '2026-11-19' }).success).toBe(false);
  });

  it('editar precisa de algum campo', () => {
    expect(updateAssetSchema.safeParse({}).success).toBe(false);
    expect(updateAssetSchema.parse({ kind: 'investment' })).toEqual({ kind: 'investment' });
  });
});
