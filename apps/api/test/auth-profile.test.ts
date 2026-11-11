import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDateOnly } from '../src/infra/date-mapping';
import { buildTestApp } from './helpers/app';
import { newUser, tokenFor } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';

const { app, authAdmin } = buildTestApp();

describe('autenticação', () => {
  beforeEach(resetDb);

  it('sem token devolve 401', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
    expect(res.body.title).toBe('Não autenticado');
  });

  it('token inválido ou expirado devolve 401', async () => {
    const garbage = await request(app).get('/api/v1/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(garbage.status).toBe(401);
    const expired = await tokenFor({ id: randomUUID(), expiresIn: Math.floor(Date.now() / 1000) - 60 });
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

describe('provisionamento e /me', () => {
  beforeEach(resetDb);

  it('cria o perfil e as 14 categorias padrão no primeiro acesso, uma única vez', async () => {
    const user = await newUser({ name: 'Ana Souza', email: 'ana@exemplo.com' });
    const first = await request(app).get('/api/v1/me').set(user.auth);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ id: user.id, name: 'Ana Souza', email: 'ana@exemplo.com', isDemo: false, theme: 'system' });
    await request(app).get('/api/v1/me').set(user.auth);
    expect(await testDb.category.count({ where: { userId: user.id } })).toBe(14);
    expect(await testDb.category.count({ where: { userId: user.id, type: 'income' } })).toBe(4);
  });

  it('requisições simultâneas de um usuário novo não quebram nem duplicam', async () => {
    const user = await newUser();
    const results = await Promise.all([1, 2, 3].map(() => request(app).get('/api/v1/me').set(user.auth)));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await testDb.category.count({ where: { userId: user.id } })).toBe(14);
  });

  it('usuário anônimo vira perfil demo', async () => {
    const user = await newUser({ isAnonymous: true });
    const res = await request(app).get('/api/v1/me').set(user.auth);
    expect(res.body).toMatchObject({ isDemo: true, email: null, name: 'Visitante' });
  });

  it('sem nome nos metadados usa o início do e-mail', async () => {
    const user = await newUser({ email: 'joao.silva@exemplo.com' });
    const res = await request(app).get('/api/v1/me').set(user.auth);
    expect(res.body.name).toBe('joao.silva');
  });

  it('PATCH /me atualiza nome e tema', async () => {
    const user = await newUser();
    const res = await request(app).patch('/api/v1/me').set(user.auth).send({ name: '  Bia ', theme: 'dark' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Bia', theme: 'dark' });
  });

  it('PATCH /me valida o corpo', async () => {
    const user = await newUser();
    const empty = await request(app).patch('/api/v1/me').set(user.auth).send({});
    expect(empty.status).toBe(400);
    const bad = await request(app).patch('/api/v1/me').set(user.auth).send({ theme: 'azul' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors[0].path).toBe('theme');
  });

  it('DELETE /me apaga todos os dados do usuário e o usuário no Auth, sem tocar nos outros', async () => {
    const user = await newUser();
    const other = await newUser();
    await request(app).get('/api/v1/me').set(user.auth);
    await request(app).get('/api/v1/me').set(other.auth);
    const account = await testDb.account.create({ data: { userId: user.id, name: 'C', type: 'checking', color: '#000000' } });
    await testDb.transaction.create({
      data: { userId: user.id, type: 'expense', amount: 100n, description: 'X', accountId: account.id, dueDate: fromDateOnly('2026-11-01') },
    });

    const res = await request(app).delete('/api/v1/me').set(user.auth);
    expect(res.status).toBe(204);
    expect(await testDb.profile.count({ where: { id: user.id } })).toBe(0);
    expect(await testDb.transaction.count({ where: { userId: user.id } })).toBe(0);
    expect(await testDb.category.count({ where: { userId: other.id } })).toBe(14);
    expect(authAdmin.deleted).toEqual([user.id]);
  });
});
