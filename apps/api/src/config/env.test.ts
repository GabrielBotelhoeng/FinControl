import { describe, expect, it } from 'vitest';
import { loadConfig } from './env';

describe('loadConfig', () => {
  it('lê e valida as variáveis', () => {
    const config = loadConfig(process.env);
    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(3333);
  });

  it('falha nomeando as variáveis ausentes', () => {
    expect(() => loadConfig({ NODE_ENV: 'test' })).toThrow(/DATABASE_URL.*SUPABASE_URL/);
  });

  it('exige CRON_SECRET com pelo menos 32 caracteres', () => {
    expect(() => loadConfig({ ...process.env, CRON_SECRET: 'curto' })).toThrow(/CRON_SECRET/);
  });

  it('rejeita WEB_PREVIEW_ORIGIN_PATTERN que não é regex válida', () => {
    expect(() => loadConfig({ ...process.env, WEB_PREVIEW_ORIGIN_PATTERN: '([' })).toThrow(/WEB_PREVIEW_ORIGIN_PATTERN/);
  });

  it('DATABASE_CA_CERT, se vier, precisa ser um certificado PEM', () => {
    expect(() => loadConfig({ ...process.env, DATABASE_CA_CERT: 'não é pem' })).toThrow(/DATABASE_CA_CERT/);
  });
});
