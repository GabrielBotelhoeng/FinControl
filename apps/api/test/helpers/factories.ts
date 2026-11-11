import type { AccountDTO } from '@fincontrol/shared';
import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { expect } from 'vitest';
import type { TestUser } from './auth';

export async function createAccount(app: Express, user: TestUser, body: Record<string, unknown> = {}): Promise<AccountDTO> {
  const res = await request(app)
    .post('/api/v1/accounts')
    .set(user.auth)
    .send({ name: `Conta ${randomUUID().slice(0, 8)}`, type: 'checking', color: '#2563eb', initialBalance: 0, ...body });
  expect(res.status).toBe(201);
  return res.body as AccountDTO;
}

export async function categoryId(app: Express, user: TestUser, name: string, type: 'income' | 'expense'): Promise<string> {
  const res = await request(app).get(`/api/v1/categories?type=${type}`).set(user.auth);
  const found = (res.body as { id: string; name: string }[]).find((c) => c.name === name);
  if (!found) throw new Error(`Categoria ${name} (${type}) não encontrada`);
  return found.id;
}

export async function createTransaction(app: Express, user: TestUser, body: Record<string, unknown>) {
  const res = await request(app).post('/api/v1/transactions').set(user.auth).send(body);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as import('@fincontrol/shared').TransactionDTO;
}
