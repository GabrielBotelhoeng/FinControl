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
    expect(accounts.body).toHaveLength(3);

    const summary = await request(app).get('/api/v1/dashboard/summary').set(visitor.auth);
    expect(summary.body.totalBalance).toBeGreaterThan(0);
    expect(summary.body.overdueCount).toBe(1);
    expect(summary.body.upcoming.some((t: { description: string }) => t.description === 'IPVA (parcela)')).toBe(true);

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
