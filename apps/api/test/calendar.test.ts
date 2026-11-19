import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

// Hoje nos testes é 2026-11-11 (FIXED_NOW).
const { app } = buildTestApp();

describe('calendário de contas', () => {
  beforeEach(resetDb);

  it('agrupa por vencimento, separa a pagar e pago, inclui a fatura e deixa transferências e compras no cartão de fora', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 500000 });
    const savings = await createAccount(app, user, { name: 'Poupança', type: 'savings' });
    const card = await createAccount(app, user, { name: 'Cartão', type: 'credit_card', creditLimit: 500000, closingDay: 5, dueDay: 15, paymentAccountId: checking.id });
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    const salary = await categoryId(app, user, 'Salário', 'income');

    await createTransaction(app, user, { type: 'expense', amount: 12000, description: 'Luz', accountId: checking.id, categoryId: food, nature: 'fixed', dueDate: '2026-11-20' });
    await createTransaction(app, user, { type: 'expense', amount: 5000, description: 'Água', accountId: checking.id, categoryId: food, nature: 'fixed', dueDate: '2026-11-03' });
    await createTransaction(app, user, { type: 'income', amount: 300000, description: 'Salário', accountId: checking.id, categoryId: salary, nature: 'fixed', dueDate: '2026-11-05', status: 'paid', paidDate: '2026-11-05' });
    await createTransaction(app, user, { type: 'transfer', amount: 1000, description: 'Guardar', accountId: checking.id, destinationAccountId: savings.id, dueDate: '2026-11-06', status: 'paid', paidDate: '2026-11-06' });
    await createTransaction(app, user, { type: 'expense', amount: 40000, description: 'Tênis', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-20' });
    await createTransaction(app, user, { type: 'expense', amount: 9999, description: 'Dezembro', accountId: checking.id, categoryId: food, nature: 'fixed', dueDate: '2026-12-01' });

    const res = await request(app).get('/api/v1/calendar?month=2026-11').set(user.auth);
    expect(res.status).toBe(200);
    const day = (d: string) => res.body.days.find((x: { date: string }) => x.date === d)?.items ?? [];
    expect(day('2026-11-03')).toEqual([expect.objectContaining({ kind: 'transaction', description: 'Água', status: 'pending', overdue: true, category: 'Alimentação' })]);
    expect(day('2026-11-05')).toEqual([expect.objectContaining({ type: 'income', status: 'paid' })]);
    expect(day('2026-11-06')).toEqual([]);
    expect(day('2026-11-20')[0]).toMatchObject({ description: 'Luz', overdue: false });
    const invoices = res.body.days.flatMap((d: { items: { kind: string }[] }) => d.items).filter((i: { kind: string }) => i.kind === 'invoice');
    expect(invoices).toEqual([expect.objectContaining({ cardName: 'Cartão', remaining: 40000, amount: 40000 })]);
    expect(res.body.days.flatMap((d: { items: { description?: string }[] }) => d.items).some((i: { description?: string }) => i.description === 'Tênis' || i.description === 'Dezembro')).toBe(false);
    expect(res.body.totals).toEqual({ toPay: 12000 + 5000 + 40000, paid: 0, toReceive: 0, received: 300000 });
  });

  it('mostra a fatura futura com as parcelas já lançadas (CodeRabbit)', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { name: 'Corrente' });
    const card = await createAccount(app, user, { name: 'Cartão', type: 'credit_card', creditLimit: 500000, closingDay: 5, dueDay: 15, paymentAccountId: checking.id });
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    await createTransaction(app, user, { type: 'expense', amount: 30000, description: 'Geladeira', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-20', installments: 3 });
    const res = await request(app).get('/api/v1/calendar?month=2027-01').set(user.auth);
    const invoices = res.body.days.flatMap((d: { items: { kind: string }[] }) => d.items).filter((i: { kind: string }) => i.kind === 'invoice');
    expect(invoices).toEqual([expect.objectContaining({ cardName: 'Cartão', amount: 10000, remaining: 10000, future: true })]);
    expect(res.body.days[0].date).toBe('2027-01-15');
  });

  it('sem mês, usa o atual; mês inválido dá 400; outro usuário não vê nada', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { name: 'Corrente' });
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    await createTransaction(app, user, { type: 'expense', amount: 100, description: 'X', accountId: checking.id, categoryId: food, nature: 'fixed', dueDate: '2026-11-12' });
    expect((await request(app).get('/api/v1/calendar').set(user.auth)).body.month).toBe('2026-11');
    expect((await request(app).get('/api/v1/calendar?month=2026-13').set(user.auth)).status).toBe(400);
    expect((await request(app).get('/api/v1/calendar?month=2027-11').set(user.auth)).status).toBe(200);
    expect((await request(app).get('/api/v1/calendar?month=2027-12').set(user.auth)).status).toBe(422);
    const other = await newUser();
    expect((await request(app).get('/api/v1/calendar').set(other.auth)).body.days).toEqual([]);
  });
});
