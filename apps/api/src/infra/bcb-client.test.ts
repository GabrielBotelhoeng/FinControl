import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { MODALITY_BY_KIND } from '../domain/loan-modalities';
import { createBcbClient } from './bcb-client';

const fixture = (name: string) => readFileSync(new URL(`../../test/fixtures/${name}`, import.meta.url), 'utf8');
const ok = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'application/json;charset=UTF-8' } });

describe('createBcbClient', () => {
  it('semanal: descobre o período mais recente e lê as taxas dele', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(ok(JSON.stringify({ value: [{ InicioPeriodo: '2026-10-23', FimPeriodo: '2026-10-29' }] })))
      .mockResolvedValueOnce(ok(fixture('bcb-veiculos-2026-10-23.json')));
    const r = await createBcbClient(fetchFn).latestRates(MODALITY_BY_KIND.vehicle!);
    expect(r).toMatchObject({ modality: 'Aquisição de veículos - Prefixado', periodStart: '2026-10-23', periodEnd: '2026-10-29' });
    expect(r!.rows).toHaveLength(39);
    expect(r!.rows.find((x) => x.cnpj8 === '00000000')).toEqual({ cnpj8: '00000000', institution: 'BCO DO BRASIL S.A.', monthlyRate: 1.12, annualRate: 14.25, position: 7 });
    // Espaços codificados como %20 (com "+" a API responde "The URI is malformed").
    expect(String(fetchFn.mock.calls[1]![0])).toContain('Aquisi%C3%A7%C3%A3o%20de%20ve%C3%ADculos');
  });

  it('mensal (imobiliário): período = o mês inteiro de `anoMes`', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(ok(JSON.stringify({ value: [{ anoMes: '2026-09' }] })))
      .mockResolvedValueOnce(ok(fixture('bcb-imobiliario-2026-09.json')));
    const r = await createBcbClient(fetchFn).latestRates(MODALITY_BY_KIND.mortgage!);
    expect(r).toMatchObject({ periodStart: '2026-09-01', periodEnd: '2026-09-30' });
    expect(r!.rows.map((x) => x.institution)).toContain('CAIXA ECONOMICA FEDERAL');
  });

  it('sem dados → null; HTTP de erro → lança', async () => {
    expect(await createBcbClient(vi.fn().mockResolvedValue(ok('{"value":[]}'))).latestRates(MODALITY_BY_KIND.personal!)).toBeNull();
    await expect(createBcbClient(vi.fn().mockResolvedValue(new Response('x', { status: 503 }))).latestRates(MODALITY_BY_KIND.personal!)).rejects.toThrow(/503/);
  });
});
