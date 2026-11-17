import type { NotificationListDTO } from '@fincontrol/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNotificationsRepository } from '../src/modules/notifications/notifications.repository';
import { createNotificationsService, type NotificationsServiceDeps } from '../src/modules/notifications/notifications.service';
import { createProfileRepository } from '../src/modules/profile/profile.repository';
import { buildTestApp, FIXED_NOW } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

const { app } = buildTestApp();
const SECRET = process.env.CRON_SECRET!;
const DAY = 24 * 60 * 60 * 1000;

const list = async (user: TestUser) => {
  const res = await request(app).get('/api/v1/notifications').set(user.auth);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as NotificationListDTO;
};

/** Hoje é 2026-11-11. */
async function scenario() {
  const user = await newUser();
  const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 500000 });
  const food = await categoryId(app, user, 'Alimentação', 'expense');
  const home = await categoryId(app, user, 'Moradia', 'expense');
  const bill = (description: string, amount: number, dueDate: string, category = home) =>
    createTransaction(app, user, { type: 'expense', amount, description, accountId: checking.id, categoryId: category, nature: 'fixed', dueDate });
  return { user, checking, food, home, bill };
}

describe('notificações', () => {
  beforeEach(resetDb);

  it('critério 1: conta vencendo em 2 dias aparece com valor e "Pagar"; depois de paga, some', async () => {
    const { user, bill } = await scenario();
    const tx = await bill('Aluguel', 180000, '2026-11-13');
    await bill('Condomínio', 50000, '2026-11-20'); // fora dos 3 dias
    const before = await list(user);
    expect(before.items).toEqual([
      {
        key: `due:${tx.id}:2026-11-13`, kind: 'bill_due', priority: 2, title: 'Aluguel', body: 'R$ 1.800,00 · vence em 2 dias',
        href: '/lancamentos?mes=2026-11', action: 'Pagar', date: '2026-11-13', read: false,
      },
    ]);
    expect(before.unreadCount).toBe(1);
    expect((await request(app).post(`/api/v1/transactions/${tx.id}/pay`).set(user.auth).send({ paidDate: '2026-11-11' })).status).toBe(200);
    expect(await list(user)).toEqual({ items: [], unreadCount: 0 });
  });

  it('critério 2: conta vencida vem no topo; meta concluída vem por último', async () => {
    const { user, bill } = await scenario();
    await bill('Aluguel', 180000, '2026-11-12');
    const late = await bill('Internet', 12000, '2026-11-05');
    const goal = await request(app).post('/api/v1/goals').set(user.auth).send({ name: 'Viagem', targetAmount: 100000, targetDate: '2027-06-30' });
    await request(app).post(`/api/v1/goals/${goal.body.id}/contributions`).set(user.auth).send({ amount: 100000, date: '2026-11-10' });
    const { items } = await list(user);
    expect(items.map((i) => i.kind)).toEqual(['bill_overdue', 'bill_due', 'goal_reached']);
    expect(items[0]).toMatchObject({ key: `overdue:${late.id}:2026-11-05`, body: 'R$ 120,00 · venceu há 6 dias' });
    expect(late.dueDate).toBe('2026-11-05');
    expect(items[2]).toMatchObject({ title: 'Meta concluída: Viagem', href: '/planejamento?aba=metas', action: 'Ver metas', date: '2026-11-11' });
  });

  it('"Pagar" de uma conta vencida no mês passado leva para os lançamentos daquele mês', async () => {
    const { user, bill } = await scenario();
    await bill('Internet', 12000, '2026-10-15');
    expect((await list(user)).items[0]).toMatchObject({ kind: 'bill_overdue', href: '/lancamentos?mes=2026-10' });
  });

  it('critério 3: orçamento perto do limite e, ao estourar, a chave muda e volta a ser não lido', async () => {
    const { user, checking, food } = await scenario();
    await request(app).put(`/api/v1/budgets/${food}`).set(user.auth).send({ limit: 50000 });
    const paid = (amount: number) =>
      createTransaction(app, user, { type: 'expense', amount, description: 'Mercado', accountId: checking.id, categoryId: food, nature: 'variable', dueDate: '2026-11-05', status: 'paid', paidDate: '2026-11-05' });
    await paid(45000);
    const near = await list(user);
    expect(near.items).toEqual([expect.objectContaining({ key: `budget:${food}:2026-11:near`, kind: 'budget_near', title: 'Alimentação perto do limite', read: false })]);
    expect(near.items[0]!.body).toMatch(/R\$\s450,00 de R\$\s500,00 \(90%\) em nov\/2026/);
    await request(app).post('/api/v1/notifications/read').set(user.auth).send({ keys: [near.items[0]!.key] });
    expect((await list(user)).unreadCount).toBe(0);
    await paid(10000);
    const over = await list(user);
    expect(over.items).toEqual([expect.objectContaining({ key: `budget:${food}:2026-11:over`, kind: 'budget_over', priority: 2, read: false })]);
    expect(over.unreadCount).toBe(1);
  });

  it('critério 4: marcar um aviso diminui o contador; "marcar todas" zera', async () => {
    const { user, bill } = await scenario();
    await bill('Aluguel', 180000, '2026-11-12');
    await bill('Luz', 20000, '2026-11-13');
    await bill('Internet', 12000, '2026-11-01');
    const all = await list(user);
    expect(all.unreadCount).toBe(3);
    const one = await request(app).post('/api/v1/notifications/read').set(user.auth).send({ keys: [all.items[1]!.key] });
    expect(one.status).toBe(200);
    expect(one.body.unreadCount).toBe(2);
    expect(one.body.items[1].read).toBe(true);
    const cleared = await request(app).post('/api/v1/notifications/read-all').set(user.auth);
    expect(cleared.body.unreadCount).toBe(0);
    expect((await list(user)).items).toHaveLength(3);
  });

  it('critério 5: preferências desligam tipos e mudam a antecedência das contas', async () => {
    const { user, bill, food } = await scenario();
    await request(app).put(`/api/v1/budgets/${food}`).set(user.auth).send({ limit: 100 });
    await createTransaction(app, user, { type: 'expense', amount: 5000, description: 'Feira', accountId: (await createAccount(app, user)).id, categoryId: food, nature: 'variable', dueDate: '2026-11-02', status: 'paid', paidDate: '2026-11-02' });
    await bill('Seguro', 30000, '2026-11-18');
    expect((await list(user)).items.map((i) => i.kind)).toEqual(['budget_over']);

    const me = await request(app).get('/api/v1/me').set(user.auth);
    expect(me.body.notificationPrefs).toEqual({ bills: true, invoices: true, budget: true, goals: true, billDays: 3 });
    const patch = await request(app).patch('/api/v1/me').set(user.auth).send({ notificationPrefs: { bills: true, invoices: true, budget: false, goals: true, billDays: 7 } });
    expect(patch.status).toBe(200);
    expect(patch.body.notificationPrefs).toMatchObject({ budget: false, billDays: 7 });
    const after = await list(user);
    expect(after.items.map((i) => [i.kind, i.title])).toEqual([['bill_due', 'Seguro']]);
    expect(after.unreadCount).toBe(1);
    expect((await request(app).patch('/api/v1/me').set(user.auth).send({ notificationPrefs: { bills: true } })).status).toBe(400);
  });

  it('fatura fechada ou vencida do cartão leva para a página do cartão', async () => {
    const { user, checking, food } = await scenario();
    const card = await createAccount(app, user, { name: 'Roxinho', type: 'credit_card', color: '#7c3aed', creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id });
    await createTransaction(app, user, { type: 'expense', amount: 30000, description: 'Tênis', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-20' });
    const { items } = await list(user);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ href: `/cartoes/${card.id}`, action: 'Ver fatura', title: 'Fatura Roxinho de nov/2026', kind: 'invoice_overdue', priority: 1 });
    // Compra em 20/10 cai na fatura de novembro (fecha 26/10, vence 05/11), já vencida em 11/11.
    expect(items[0]!.body).toMatch(/^R\$\s300,00 a pagar · venceu há 6 dias$/);
  });

  it('meta concluída some 30 dias depois da primeira vez', async () => {
    const { user } = await scenario();
    const goal = await request(app).post('/api/v1/goals').set(user.auth).send({ name: 'Viagem', targetAmount: 100000, targetDate: '2027-06-30' });
    await request(app).post(`/api/v1/goals/${goal.body.id}/contributions`).set(user.auth).send({ amount: 100000, date: '2026-11-10' });
    expect((await list(user)).items).toHaveLength(1);
    await testDb.notification.updateMany({ data: { firstSeenAt: new Date(FIXED_NOW.getTime() - 31 * DAY) } });
    expect((await list(user)).items).toEqual([]);
  });

  it('N8: o cron diário apaga a memória inativa há mais de 60 dias', async () => {
    const { user, bill } = await scenario();
    await bill('Aluguel', 180000, '2026-11-12');
    await list(user);
    await testDb.notification.create({ data: { userId: (await testDb.notification.findFirstOrThrow()).userId, key: 'due:velho:2026-08-01', lastActiveAt: new Date(FIXED_NOW.getTime() - 61 * DAY) } });
    const res = await request(app).get('/api/v1/internal/cron/cleanup-demo').set('Authorization', `Bearer ${SECRET}`);
    expect(res.body).toMatchObject({ notificationsPurged: 1 });
    expect(await testDb.notification.count()).toBe(1);
  });

  it('isolamento: outro usuário não vê nem marca os avisos de ninguém', async () => {
    const { user, bill } = await scenario();
    await bill('Aluguel', 180000, '2026-11-12');
    const { items } = await list(user);
    const other = await newUser();
    expect(await list(other)).toEqual({ items: [], unreadCount: 0 });
    await request(app).post('/api/v1/notifications/read').set(other.auth).send({ keys: [items[0]!.key] });
    expect((await list(user)).unreadCount).toBe(1);
    expect((await request(app).post('/api/v1/notifications/read').set(user.auth).send({ keys: [] })).status).toBe(400);
    expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
  });

  it('uma fonte com erro não derruba as outras: as contas continuam e o erro vai para o log', async () => {
    const { user, bill } = await scenario();
    await bill('Aluguel', 180000, '2026-11-12');
    const boom = async (): Promise<never> => {
      throw new Error('fora do ar');
    };
    const logger = { error: vi.fn() };
    const service = createNotificationsService({
      repo: createNotificationsRepository(testDb),
      profileRepo: createProfileRepository(testDb),
      recurrences: { materialize: async () => {} },
      cards: { accountsRepo: { list: boom }, cards: { listInvoices: boom }, installmentTotalsByAccount: boom } as unknown as NotificationsServiceDeps['cards'],
      budgets: { getMonth: boom },
      goals: { list: boom },
      logger,
      clock: () => FIXED_NOW,
    });
    const result = await service.list(user.id);
    expect(result.items.map((i) => i.title)).toEqual(['Aluguel']);
    expect(logger.error.mock.calls.map((c) => (c[0] as { source: string }).source).sort()).toEqual(['budget', 'goals', 'invoices']);
  });
});
