import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env';
import { buildTestApp } from './helpers/app';

const { app } = buildTestApp();

describe('infraestrutura HTTP', () => {
  it('GET /api/v1/health responde ok com X-Request-Id', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', version: '0.1.0' });
    expect(res.headers['x-request-id']).toMatch(/^[\w-]+$/);
  });

  it('reaproveita um X-Request-Id válido recebido', async () => {
    const res = await request(app).get('/api/v1/health').set('X-Request-Id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });

  it('rota inexistente devolve 404 em problem+json', async () => {
    const res = await request(app).get('/nao-existe');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 404, title: 'Rota não encontrada' });
  });

  it('JSON malformado devolve 400', async () => {
    const res = await request(app).post('/nao-existe').set('Content-Type', 'application/json').send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ status: 400, title: 'JSON inválido' });
  });

  it('rate limit separa clientes atrás do proxy (X-Forwarded-For)', async () => {
    const { app: prodApp } = buildTestApp({ config: { ...loadConfig(), NODE_ENV: 'production' } });
    for (let i = 0; i < 300; i++) await request(prodApp).get('/api/v1/health').set('X-Forwarded-For', '203.0.113.1');
    expect((await request(prodApp).get('/api/v1/health').set('X-Forwarded-For', '203.0.113.1')).status).toBe(429);
    expect((await request(prodApp).get('/api/v1/health').set('X-Forwarded-For', '203.0.113.2')).status).toBe(200);
  }, 60_000);

  it('aplica cabeçalhos de segurança e CORS restrito', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
