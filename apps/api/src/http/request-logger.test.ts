import express from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requestLogger } from './request-logger';

describe('requestLogger', () => {
  it('registra só id, método, URL e status, sem headers', async () => {
    const lines: string[] = [];
    const logger = pino({ level: 'info' }, { write: (line: string) => lines.push(line) });
    const app = express();
    app.use(requestLogger(logger));
    app.get('/ping', (_req, res) => {
      res.json({ ok: true });
    });

    await request(app)
      .get('/ping')
      .set('Authorization', 'Bearer segredo')
      .set('X-Vercel-Protection-Bypass', 'bypass-secreto')
      .set('X-Forwarded-For', '203.0.113.7')
      .expect(200);

    const entry = JSON.parse(lines.at(-1) ?? '{}');
    expect(entry.req).toEqual({ id: expect.any(String), method: 'GET', url: '/ping' });
    expect(entry.res).toEqual({ statusCode: 200 });
    expect(lines.join('\n')).not.toMatch(/segredo|bypass-secreto|203\.0\.113\.7/);
  });
});
