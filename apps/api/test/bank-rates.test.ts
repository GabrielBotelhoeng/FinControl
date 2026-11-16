import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toDateOnly } from '../src/infra/date-mapping';
import { buildTestApp } from './helpers/app';
import { newUser } from './helpers/auth';
import { readFixture, seedBankRatesFromFixture } from './helpers/bank-rates';
import { resetDb, testDb } from './helpers/db';

const VEHICLES = 'Aquisição de veículos - Prefixado';
const SECRET = process.env.CRON_SECRET!;
const json = (body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 });

/** Banco Central falso: só veículos tem dados (o período de 2026-10-23); as outras modalidades vêm vazias. */
function fakeBcb() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = decodeURIComponent(String(input));
    if (!url.includes(VEHICLES)) return json({ value: [] });
    if (url.includes('$select=')) return json({ value: [{ InicioPeriodo: '2026-10-23', FimPeriodo: '2026-10-29' }] });
    return json(readFixture('bcb-veiculos-2026-10-23.json'));
  });
}

describe('taxas do Banco Central', () => {
  beforeEach(resetDb);

  it('sync grava o período mais recente de cada modalidade e mantém as sem dados', async () => {
    const res = await request(buildTestApp({ fetchFn: fakeBcb() }).app)
      .get('/api/v1/internal/cron/sync-bank-rates')
      .set('Authorization', `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body).toContainEqual({ modality: VEHICLES, status: 'updated', rows: 39 });
    expect(res.body.filter((r: { status: string }) => r.status === 'kept')).toHaveLength(5);
    const rows = await testDb.bankRate.findMany({ where: { modality: VEHICLES } });
    expect(rows).toHaveLength(39);
    expect(toDateOnly(rows[0]!.periodStart)).toBe('2026-10-23');
    expect(toDateOnly(rows[0]!.periodEnd)).toBe('2026-10-29');
  });

  it('período novo substitui o antigo da mesma modalidade', async () => {
    await seedBankRatesFromFixture('bcb-veiculos-2026-10-23.json', '2026-10-16', '2026-10-22');
    await request(buildTestApp({ fetchFn: fakeBcb() }).app).get('/api/v1/internal/cron/sync-bank-rates').set('Authorization', `Bearer ${SECRET}`);
    const starts = await testDb.bankRate.findMany({ where: { modality: VEHICLES }, select: { periodStart: true }, distinct: ['periodStart'] });
    expect(starts.map((s) => toDateOnly(s.periodStart))).toEqual(['2026-10-23']);
  });

  it('Banco Central fora do ar não apaga os dados anteriores', async () => {
    await seedBankRatesFromFixture('bcb-veiculos-2026-10-23.json');
    const down = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const res = await request(buildTestApp({ fetchFn: down }).app).get('/api/v1/internal/cron/sync-bank-rates').set('Authorization', `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body.every((r: { status: string }) => r.status === 'kept')).toBe(true);
    expect(await testDb.bankRate.count({ where: { modality: VEHICLES } })).toBe(39);
  });

  it('cron sem segredo dá 401', async () => {
    const res = await request(buildTestApp({ fetchFn: fakeBcb() }).app).get('/api/v1/internal/cron/sync-bank-rates');
    expect(res.status).toBe(401);
  });

  it('CodeRabbit: posição e total contam só as linhas guardadas (linha inválida antes do banco não gera "7º de 38")', async () => {
    const raw = JSON.parse(readFixture('bcb-veiculos-2026-10-23.json')) as { value: { Posicao: number; TaxaJurosAoMes: number | null }[] };
    const dirty = { value: raw.value.map((r) => (r.Posicao === 1 ? { ...r, TaxaJurosAoMes: null } : r)) };
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = decodeURIComponent(String(input));
      if (!url.includes(VEHICLES)) return json({ value: [] });
      if (url.includes('$select=')) return json({ value: [{ InicioPeriodo: '2026-10-23', FimPeriodo: '2026-10-29' }] });
      return json(dirty);
    });
    const { app, deps } = buildTestApp({ fetchFn });
    await request(app).get('/api/v1/internal/cron/sync-bank-rates').set('Authorization', `Bearer ${SECRET}`);
    const { buildContainer } = await import('../src/http/container');
    const comparison = await buildContainer(deps).bankRates.comparison(VEHICLES, '00000000');
    expect(comparison!.bank).toMatchObject({ position: 6, of: 38 });
  });

  it('comparison: banco na lista, banco fora da lista e modalidade sem dados', async () => {
    await seedBankRatesFromFixture('bcb-veiculos-2026-10-23.json');
    const { deps } = buildTestApp();
    const { buildContainer } = await import('../src/http/container');
    const { bankRates } = buildContainer(deps);
    expect(await bankRates.comparison(VEHICLES, '00000000')).toEqual({
      modality: VEHICLES, periodStart: '2026-10-23', periodEnd: '2026-10-29', source: 'Banco Central do Brasil',
      bank: { name: 'BCO DO BRASIL S.A.', monthlyRate: 0.0112, annualRate: 0.1425, position: 7, of: 39 },
      market: { monthlyRate: 0.017, annualRate: expect.any(Number) },
    });
    expect((await bankRates.comparison(VEHICLES, '99999999'))!.bank).toBeNull();
    expect(await bankRates.comparison(VEHICLES, null)).toMatchObject({ bank: null, market: { monthlyRate: 0.017 } });
    expect(await bankRates.comparison('Crédito pessoal não consignado - Prefixado', '00000000')).toBeNull();
  });

  it('GET /banks busca instituições sem repetir, e exige login', async () => {
    await seedBankRatesFromFixture('bcb-veiculos-2026-10-23.json');
    await seedBankRatesFromFixture('bcb-imobiliario-2026-09.json');
    const { app } = buildTestApp();
    const user = await newUser();
    const res = await request(app).get('/api/v1/banks?q=brasil').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body).toContainEqual({ cnpj8: '00000000', name: 'BCO DO BRASIL S.A.' });
    const caixa = (await request(app).get('/api/v1/banks?q=caixa').set(user.auth)).body;
    expect(caixa.filter((b: { cnpj8: string }) => b.cnpj8 === '00360305')).toHaveLength(1);
    expect((await request(app).get('/api/v1/banks?q=brasil')).status).toBe(401);
  });

  it('revisão: linha repetida ou sem taxa no Banco Central não trava a modalidade', async () => {
    const raw = JSON.parse(readFixture('bcb-veiculos-2026-10-23.json')) as { value: Record<string, unknown>[] };
    const dirty = { value: [...raw.value, { ...raw.value[0]! }, { ...raw.value[1]!, cnpj8: '12345678', TaxaJurosAoMes: null }] };
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = decodeURIComponent(String(input));
      if (!url.includes(VEHICLES)) return json({ value: [] });
      if (url.includes('$select=')) return json({ value: [{ InicioPeriodo: '2026-10-23', FimPeriodo: '2026-10-29' }] });
      return json(dirty);
    });
    const res = await request(buildTestApp({ fetchFn }).app).get('/api/v1/internal/cron/sync-bank-rates').set('Authorization', `Bearer ${SECRET}`);
    expect(res.body).toContainEqual({ modality: VEHICLES, status: 'updated', rows: 39 });
    expect(await testDb.bankRate.count({ where: { modality: VEHICLES } })).toBe(39);
  });

  it('pendência: "banco do brasil" acha "BCO DO BRASIL S.A." (o Banco Central abrevia "banco")', async () => {
    await seedBankRatesFromFixture('bcb-veiculos-2026-10-23.json');
    const { app } = buildTestApp();
    const user = await newUser();
    const res = await request(app).get('/api/v1/banks?q=Banco do Brasil').set(user.auth);
    expect(res.body).toContainEqual({ cnpj8: '00000000', name: 'BCO DO BRASIL S.A.' });
    // CodeRabbit: nomes com "BANCO" por extenso continuam achados.
    const hyundai = (await request(app).get('/api/v1/banks?q=Banco Hyundai').set(user.auth)).body;
    expect(hyundai.map((b: { name: string }) => b.name)).toContain('BANCO HYUNDAI CAPITAL BRASIL');
  });
});
