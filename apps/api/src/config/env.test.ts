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
});
