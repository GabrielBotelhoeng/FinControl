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
