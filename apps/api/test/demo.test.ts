import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, FIXED_NOW } from './helpers/app';
import { newUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';

const { app, authAdmin } = buildTestApp();
const SECRET = process.env.CRON_SECRET!;
const DAY = 24 * 60 * 60 * 1000;

describe('conta demo', () => {
  beforeEach(resetDb);

  it('só usuário anônimo pode gerar a demo', async () => {
    const user = await newUser();
    expect((await request(app).post('/api/v1/demo/seed').set(user.auth)).status).toBe(403);
  });

  it('gera 6 meses de dados coerentes, uma única vez', async () => {
    const visitor = await newUser({ isAnonymous: true });
    expect((await request(app).post('/api/v1/demo/seed').set(visitor.auth)).body).toEqual({ seeded: true });
    expect((await request(app).post('/api/v1/demo/seed').set(visitor.auth)).body).toEqual({ seeded: false });

    const accounts = await request(app).get('/api/v1/accounts').set(visitor.auth);
    expect(accounts.body).toHaveLength(4);

    // Cartão "Cartão principal" (Tarefa 9): limite consumido (há compras não pagas) e nenhuma fatura vencida.
    const card = (accounts.body as { id: string; type: string; card: { limitAvailable: number } | null }[]).find(
      (a) => a.type === 'credit_card',
    );
    expect(card?.card?.limitAvailable).toBeLessThan(800000);

    const summary = await request(app).get('/api/v1/dashboard/summary').set(visitor.auth);
    expect(summary.body.totalBalance).toBeGreaterThan(0);
    expect(summary.body.overdueCount).toBe(1);
    expect(summary.body.upcoming.some((t: { description: string }) => t.description === 'IPVA (parcela)')).toBe(true);
    // Comprometimento de renda (decisão R15): a parcela da compra em 10x que cai na fatura do mês corrente.
    expect(summary.body.health.debtCommitment).toBeGreaterThan(0);

    const invoices = await request(app).get(`/api/v1/cards/${card!.id}/invoices`).set(visitor.auth);
    expect(invoices.body.length).toBeGreaterThan(0);
    expect(invoices.body.some((i: { status: string }) => i.status === 'overdue')).toBe(false);

    const evolution = await request(app).get('/api/v1/dashboard/evolution?months=6').set(visitor.auth);
    for (const point of evolution.body as { income: number; expense: number }[]) {
      expect(point.income).toBeGreaterThan(0);
      expect(point.expense).toBeGreaterThan(0);
    }
  });
});

describe('limpeza agendada das demos', () => {
  beforeEach(resetDb);

  async function profile(isDemo: boolean, ageDays: number) {
    const id = randomUUID();
    await testDb.profile.create({ data: { id, name: 'X', isDemo, createdAt: new Date(FIXED_NOW.getTime() - ageDays * DAY) } });
    return id;
  }

  it('o seed é atômico: se falhar no meio, nada fica gravado e a demo pode ser gerada de novo', async () => {
    // O seed lê o relógio no início e de novo ao materializar as recorrências, depois de já ter gravado
    // contas, recorrências e lançamentos. Falhar nessa 2ª leitura simula um erro no meio do caminho.
    let failOnCall = 0;
    let calls = 0;
    const clock = () => {
      calls += 1;
      if (calls === failOnCall) throw new Error('falha simulada no meio do seed');
      return FIXED_NOW;
    };
    const { app: flaky } = buildTestApp({ clock });
    const visitor = await newUser({ isAnonymous: true });

    calls = 0;
    failOnCall = 2;
    expect((await request(flaky).post('/api/v1/demo/seed').set(visitor.auth)).status).toBe(500);
    failOnCall = 0;

    expect((await request(flaky).get('/api/v1/accounts').set(visitor.auth)).body).toEqual([]);
    expect(await testDb.transaction.count({ where: { userId: visitor.id } })).toBe(0);
    expect((await request(flaky).post('/api/v1/demo/seed').set(visitor.auth)).body).toEqual({ seeded: true });
    expect((await request(flaky).get('/api/v1/accounts').set(visitor.auth)).body).toHaveLength(4);
  });

  it('dois seeds simultâneos do mesmo visitante geram a demo uma única vez', async () => {
    const visitor = await newUser({ isAnonymous: true });
    await request(app).get('/api/v1/me').set(visitor.auth); // provisiona antes, como o app faz
    const results = await Promise.all([1, 2, 3].map(() => request(app).post('/api/v1/demo/seed').set(visitor.auth)));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(results.filter((r) => r.body.seeded === true)).toHaveLength(1);
    expect((await request(app).get('/api/v1/accounts').set(visitor.auth)).body).toHaveLength(4);
  });

  it('apaga só demos com mais de 7 dias', async () => {
    const oldDemo = await profile(true, 8);
    await profile(true, 1);
    await profile(false, 30);
    const res = await request(app).get('/api/v1/internal/cron/cleanup-demo').set('Authorization', `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: 1 });
    expect(authAdmin.deleted).toEqual([oldDemo]);
    expect(await testDb.profile.count()).toBe(2);
  });

  it('exige o segredo do cron', async () => {
    expect((await request(app).get('/api/v1/internal/cron/cleanup-demo')).status).toBe(401);
    expect((await request(app).post('/api/v1/internal/cron/cleanup-demo').set('Authorization', 'Bearer errado')).status).toBe(401);
  });
});
