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

  it('VAPID: as três juntas e com o formato das chaves (Web Push)', () => {
    const { VAPID_PUBLIC_KEY: _p, ...noPublic } = process.env;
    expect(() => loadConfig(noPublic)).toThrow(/VAPID_PUBLIC_KEY/);
    expect(() => loadConfig({ ...process.env, VAPID_PRIVATE_KEY: 'curta' })).toThrow(/VAPID_PRIVATE_KEY/);
    expect(() => loadConfig({ ...process.env, VAPID_SUBJECT: 'eu@exemplo.com' })).toThrow(/VAPID_SUBJECT/);
    const { VAPID_PUBLIC_KEY: _a, VAPID_PRIVATE_KEY: _b, VAPID_SUBJECT: _c, ...none } = process.env;
    expect(loadConfig(none).VAPID_PUBLIC_KEY).toBeUndefined();
  });
  it('assistente: chave com o prefixo da Anthropic, modelo padrão e lista de e-mails normalizada', () => {
    expect(() => loadConfig({ ...process.env, ANTHROPIC_API_KEY: 'outra' })).toThrow(/ANTHROPIC_API_KEY/);
    const config = loadConfig({ ...process.env, AI_ALLOWED_EMAILS: ' Ana@x.com, ,bia@y.com ' });
    expect(config.AI_MODEL).toBe('claude-haiku-4-5-20251001');
    expect(config.AI_ALLOWED_EMAILS).toEqual(['ana@x.com', 'bia@y.com']);
    expect(loadConfig({ ...process.env, AI_ALLOWED_EMAILS: undefined }).AI_ALLOWED_EMAILS).toEqual([]);
  });
});
