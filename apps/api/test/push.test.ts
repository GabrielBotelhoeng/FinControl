import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PushPayload, PushResult, PushTarget } from '../src/infra/push-sender';
import { loadConfig } from '../src/config/env';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

const SECRET = process.env.CRON_SECRET!;

/** Envio falso: guarda o que foi mandado; um endereço com "gone" responde como assinatura expirada. */
function fakeSender() {
  const sent: { target: PushTarget; payload: PushPayload }[] = [];
  const sender = async (target: PushTarget, payload: PushPayload): Promise<PushResult> => {
    if (target.endpoint.includes('gone')) return 'gone';
    sent.push({ target, payload });
    return 'sent';
  };
  return { sent, sender };
}

const fake = fakeSender();
const { app } = buildTestApp({ pushSender: fake.sender });
const endpoint = (id: string) => `https://fcm.googleapis.com/fcm/send/${id}`;
const keys = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const subscribe = (user: TestUser, id: string) => request(app).post('/api/v1/push/subscriptions').set(user.auth).send({ endpoint: endpoint(id), keys });
const cron = () => request(app).get('/api/v1/internal/cron/send-push').set('Authorization', `Bearer ${SECRET}`);

async function withBills(user: TestUser) {
  const checking = await createAccount(app, user, { initialBalance: 100000 });
  const home = await categoryId(app, user, 'Moradia', 'expense');
  const bill = (description: string, dueDate: string) =>
    createTransaction(app, user, { type: 'expense', amount: 10000, description, accountId: checking.id, nature: 'fixed', categoryId: home, dueDate });
  return { checking, bill };
}

describe('Web Push (sub-projeto 5, Parte B)', () => {
  beforeEach(async () => {
    await resetDb();
    fake.sent.length = 0;
  });

  it('config devolve a chave pública; sem chaves VAPID, o push fica desligado', async () => {
    const user = await newUser();
    expect((await request(app).get('/api/v1/push/config').set(user.auth)).body).toEqual({ enabled: true, publicKey: process.env.VAPID_PUBLIC_KEY });
    const { VAPID_PUBLIC_KEY: _a, VAPID_PRIVATE_KEY: _b, VAPID_SUBJECT: _c, ...rest } = loadConfig();
    const off = buildTestApp({ config: rest as ReturnType<typeof loadConfig> }).app;
    expect((await request(off).get('/api/v1/push/config').set(user.auth)).body).toEqual({ enabled: false, publicKey: null });
    expect((await request(off).post('/api/v1/push/subscriptions').set(user.auth).send({ endpoint: endpoint('x'), keys })).status).toBe(503);
  });

  it('W5: assinatura de serviço conhecido entra; endereço interno é recusado', async () => {
    const user = await newUser();
    expect((await subscribe(user, 'a')).status).toBe(204);
    expect(await testDb.pushSubscription.count()).toBe(1);
    const bad = await request(app).post('/api/v1/push/subscriptions').set(user.auth).send({ endpoint: 'https://169.254.169.254/latest/meta-data', keys });
    expect(bad.status).toBe(400);
    expect(await testDb.pushSubscription.count()).toBe(1);
  });

  it('W6: o mesmo navegador ativado por outra pessoa passa para ela; desativar só apaga a própria', async () => {
    const ana = await newUser();
    const bia = await newUser();
    await subscribe(ana, 'mesmo');
    await subscribe(bia, 'mesmo');
    expect(await testDb.pushSubscription.findMany({ select: { userId: true } })).toEqual([{ userId: bia.id }]);
    await request(app).delete('/api/v1/push/subscriptions').set(ana.auth).send({ endpoint: endpoint('mesmo') });
    expect(await testDb.pushSubscription.count()).toBe(1);
    await request(app).delete('/api/v1/push/subscriptions').set(bia.auth).send({ endpoint: endpoint('mesmo') });
    expect(await testDb.pushSubscription.count()).toBe(0);
  });

  it('critério 1: o aviso de teste vai para os aparelhos da pessoa', async () => {
    const user = await newUser();
    await subscribe(user, 'celular');
    await subscribe(user, 'notebook');
    const res = await request(app).post('/api/v1/push/test').set(user.auth);
    expect(res.body).toEqual({ sent: 2 });
    expect(fake.sent.map((s) => s.payload.title)).toEqual(['Os avisos do FinControl estão ligados', 'Os avisos do FinControl estão ligados']);
    expect((await testDb.pushSubscription.findMany()).every((s) => s.lastSuccessAt !== null)).toBe(true);
  });

  it('critério 2: o envio diário manda uma mensagem só com os avisos novos e não repete no dia seguinte', async () => {
    const user = await newUser();
    const { bill } = await withBills(user);
    await bill('Aluguel', '2026-11-05');
    await bill('Luz', '2026-11-12');
    await subscribe(user, 'celular');

    const first = await cron();
    expect(first.body).toEqual({ users: 1, sent: 1, removed: 0 });
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]!.payload).toEqual({
      title: 'Aluguel', body: 'R$ 100,00 · venceu há 6 dias · e mais 1 aviso', url: '/notificacoes', tag: 'fincontrol-diario',
    });

    expect((await cron()).body).toEqual({ users: 1, sent: 0, removed: 0 });
    await bill('Internet', '2026-11-13');
    await cron();
    expect(fake.sent.at(-1)!.payload.title).toBe('Internet');
    expect(fake.sent.at(-1)!.payload.body).not.toContain('e mais');
  });

  it('aviso já lido na central não vai por push; demo fica de fora', async () => {
    const user = await newUser();
    const { bill } = await withBills(user);
    await bill('Aluguel', '2026-11-12');
    await subscribe(user, 'celular');
    await request(app).post('/api/v1/notifications/read-all').set(user.auth);
    expect((await cron()).body).toMatchObject({ sent: 0 });

    const visitor = await newUser({ isAnonymous: true });
    await request(app).post('/api/v1/demo/seed').set(visitor.auth);
    await subscribe(visitor, 'demo');
    expect((await cron()).body).toEqual({ users: 1, sent: 0, removed: 0 });
  });

  it('critério 3: assinatura expirada é apagada no envio', async () => {
    const user = await newUser();
    const { bill } = await withBills(user);
    await bill('Aluguel', '2026-11-12');
    await subscribe(user, 'gone-antigo');
    await subscribe(user, 'celular');
    expect((await cron()).body).toEqual({ users: 1, sent: 1, removed: 1 });
    expect((await testDb.pushSubscription.findMany()).map((s) => s.endpoint)).toEqual([endpoint('celular')]);
  });

  it('preferências valem para o push e o cron exige o segredo', async () => {
    const user = await newUser();
    const { bill } = await withBills(user);
    await bill('Aluguel', '2026-11-12');
    await subscribe(user, 'celular');
    await request(app).patch('/api/v1/me').set(user.auth).send({ notificationPrefs: { bills: false, invoices: true, budget: true, goals: true, billDays: 3 } });
    expect((await cron()).body).toMatchObject({ sent: 0 });
    expect((await request(app).get('/api/v1/internal/cron/send-push')).status).toBe(401);
  });
});
