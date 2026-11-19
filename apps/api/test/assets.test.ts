import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb } from './helpers/db';

// Hoje nos testes é 2026-11-11 (FIXED_NOW).
const { app } = buildTestApp();

async function createAsset(user: TestUser, over: Record<string, unknown> = {}) {
  return request(app).post('/api/v1/assets').set(user.auth).send({ name: 'Carro', kind: 'vehicle', value: 4000000, ...over });
}
const addValuation = (user: TestUser, id: string, amount: number, date: string) =>
  request(app).post(`/api/v1/assets/${id}/valuations`).set(user.auth).send({ amount, date });
const dates = (detail: { valuations: { date: string; amount: number }[] }) => detail.valuations.map((v) => [v.date, v.amount]);

describe('bens (sub-projeto 11)', () => {
  beforeEach(resetDb);

  it('cadastro com data no passado e valor na compra: dois registros e o resumo (B5)', async () => {
    const user = await newUser();
    const res = await createAsset(user, { since: '2025-06-01', purchaseValue: 4500000 });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ name: 'Carro', kind: 'vehicle', value: 4000000, since: '2025-06-01', firstValue: 4500000, updatedOn: '2026-11-11' });
    expect(dates(res.body)).toEqual([['2026-11-11', 4000000], ['2025-06-01', 4500000]]);
  });

  it('sem data, um registro hoje; data passada sem valor na compra, um registro com o valor de hoje', async () => {
    const user = await newUser();
    const today = await createAsset(user, { purchaseValue: 999 });
    expect(dates(today.body)).toEqual([['2026-11-11', 4000000]]);
    const past = await createAsset(user, { name: 'Previdência', kind: 'investment', value: 1350000, since: '2026-01-15' });
    expect(past.body).toMatchObject({ since: '2026-01-15', firstValue: 1350000, value: 1350000 });
    expect(dates(past.body)).toEqual([['2026-01-15', 1350000]]);
    const same = await createAsset(user, { since: '2026-01-15', purchaseValue: 4000000 });
    expect(dates(same.body)).toEqual([['2026-01-15', 4000000]]);
  });

  it('data no futuro dá 422; antes de 1900 e valor zero dão 400', async () => {
    const user = await newUser();
    const future = await createAsset(user, { since: '2026-11-12' });
    expect(future.status).toBe(422);
    expect(future.body.detail).toBe('A data não pode estar no futuro.');
    expect((await createAsset(user, { since: '1899-12-31' })).status).toBe(400);
    expect((await createAsset(user, { value: 0 })).status).toBe(400);
  });

  it('atualizar valor: data passada antecipa o "desde", zero vale e data futura dá 422 (B6)', async () => {
    const user = await newUser();
    const asset = (await createAsset(user, { since: '2026-03-01' })).body;
    const earlier = await addValuation(user, asset.id, 4600000, '2025-12-20');
    expect(earlier.status).toBe(201);
    expect(earlier.body).toMatchObject({ since: '2025-12-20', firstValue: 4600000, value: 4000000 });
    const sold = await addValuation(user, asset.id, 0, '2026-11-11');
    expect(sold.body).toMatchObject({ value: 0, updatedOn: '2026-11-11' });
    expect((await addValuation(user, asset.id, 100, '2026-11-12')).status).toBe(422);
  });

  it('revisão: a venda (valor 0) não pode ficar antes de um valor maior que zero já registrado (B6)', async () => {
    const user = await newUser();
    const asset = (await createAsset(user, { since: '2025-06-01', purchaseValue: 4500000 })).body;
    const early = await addValuation(user, asset.id, 0, '2026-09-01');
    expect(early.status).toBe(422);
    expect(early.body.detail).toBe('Há um valor registrado depois desta data. Para registrar a venda nela, exclua antes os valores posteriores.');
    expect((await addValuation(user, asset.id, 0, '2026-11-11')).body.value).toBe(0);
    // Com a venda já registrada, antecipar a data dela vale: o registro posterior também é zero.
    const moved = await addValuation(user, asset.id, 0, '2026-09-01');
    expect(moved.status).toBe(201);
    expect(moved.body.value).toBe(0);
  });

  it('revisão: excluir dois registros ao mesmo tempo não deixa o bem sem valor', async () => {
    const user = await newUser();
    const asset = (await createAsset(user, { since: '2025-06-01', purchaseValue: 4500000 })).body;
    const results = await Promise.all(
      asset.valuations.map((v: { id: string }) => request(app).delete(`/api/v1/assets/${asset.id}/valuations/${v.id}`).set(user.auth)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([204, 422]);
    expect((await request(app).get(`/api/v1/assets/${asset.id}`).set(user.auth)).body.valuations).toHaveLength(1);
  });

  it('lista do maior valor ao menor, com o bem vendido no fim', async () => {
    const user = await newUser();
    const car = (await createAsset(user)).body;
    await createAsset(user, { name: 'Apartamento', kind: 'property', value: 35000000 });
    await createAsset(user, { name: 'Bicicleta', kind: 'other', value: 150000 });
    await addValuation(user, car.id, 0, '2026-11-11');
    const list = await request(app).get('/api/v1/assets').set(user.auth);
    expect(list.body.map((a: { name: string; value: number }) => [a.name, a.value])).toEqual([['Apartamento', 35000000], ['Bicicleta', 150000], ['Carro', 0]]);
  });

  it('excluir um registro; o único dá 422 (B6)', async () => {
    const user = await newUser();
    const asset = (await createAsset(user, { since: '2025-06-01', purchaseValue: 4500000 })).body;
    const [todayId, firstId] = asset.valuations.map((v: { id: string }) => v.id);
    expect((await request(app).delete(`/api/v1/assets/${asset.id}/valuations/${todayId}`).set(user.auth)).status).toBe(204);
    const detail = (await request(app).get(`/api/v1/assets/${asset.id}`).set(user.auth)).body;
    expect(detail).toMatchObject({ value: 4500000, updatedOn: '2025-06-01' });
    const only = await request(app).delete(`/api/v1/assets/${asset.id}/valuations/${firstId}`).set(user.auth);
    expect(only.status).toBe(422);
    expect(only.body.detail).toBe('Este é o único valor do bem. Para tirar o bem do patrimônio, exclua o bem.');
  });

  it('editar o nome e o tipo, e excluir o bem com o histórico (B7)', async () => {
    const user = await newUser();
    const asset = (await createAsset(user)).body;
    const patched = await request(app).patch(`/api/v1/assets/${asset.id}`).set(user.auth).send({ name: 'Moto', kind: 'vehicle' });
    expect(patched.body).toMatchObject({ name: 'Moto', value: 4000000 });
    expect((await request(app).patch(`/api/v1/assets/${asset.id}`).set(user.auth).send({})).status).toBe(400);
    expect((await request(app).delete(`/api/v1/assets/${asset.id}`).set(user.auth)).status).toBe(204);
    expect((await request(app).get(`/api/v1/assets/${asset.id}`).set(user.auth)).status).toBe(404);
  });

  it('o bem de outra pessoa dá 404 em tudo', async () => {
    const owner = await newUser();
    const other = await newUser();
    const asset = (await createAsset(owner, { since: '2025-06-01', purchaseValue: 4500000 })).body;
    const valuationId = asset.valuations[0].id;
    expect((await request(app).get(`/api/v1/assets/${asset.id}`).set(other.auth)).status).toBe(404);
    expect((await request(app).patch(`/api/v1/assets/${asset.id}`).set(other.auth).send({ name: 'Meu' })).status).toBe(404);
    expect((await addValuation(other, asset.id, 1, '2026-11-11')).status).toBe(404);
    expect((await request(app).delete(`/api/v1/assets/${asset.id}/valuations/${valuationId}`).set(other.auth)).status).toBe(404);
    expect((await request(app).delete(`/api/v1/assets/${asset.id}`).set(other.auth)).status).toBe(404);
    expect((await request(app).get('/api/v1/assets').set(other.auth)).body).toEqual([]);
    expect((await request(app).get(`/api/v1/assets/${asset.id}`).set(owner.auth)).body.valuations).toHaveLength(2);
  });
});
