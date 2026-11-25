import { describe, expect, it } from 'vitest';
import { checkEnv } from './env';

const valid = { VITE_API_URL: 'http://localhost:3333/api/v1', VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'chave' };

describe('checkEnv', () => {
  it('aceita a configuração completa', () => {
    expect(checkEnv(valid)).toEqual({ ok: true, env: valid });
  });

  it('lista as variáveis ausentes ou inválidas, sem lançar erro', () => {
    expect(checkEnv({ VITE_API_URL: 'não-é-url' })).toEqual({
      ok: false,
      fields: ['VITE_API_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    });
  });

  it('recusa chave vazia, valor que não é texto e endereço sem protocolo', () => {
    expect(checkEnv({ ...valid, VITE_SUPABASE_ANON_KEY: '' })).toEqual({ ok: false, fields: ['VITE_SUPABASE_ANON_KEY'] });
    expect(checkEnv({ ...valid, VITE_API_URL: 42 })).toEqual({ ok: false, fields: ['VITE_API_URL'] });
    expect(checkEnv({ ...valid, VITE_SUPABASE_URL: 'localhost:54321' })).toEqual({ ok: false, fields: ['VITE_SUPABASE_URL'] });
  });

  it('devolve só as três variáveis, mesmo que venham outras', () => {
    expect(checkEnv({ ...valid, VITE_OUTRA: 'x' })).toEqual({ ok: true, env: valid });
  });

  it('não usa o zod: ele ficaria no pedaço de entrada de todo mundo (sub-projeto 18, E10)', async () => {
    const { readFileSync } = await import('node:fs');
    // O Vitest roda a partir de apps/web.
    expect(readFileSync('src/lib/env.ts', 'utf8')).not.toMatch(/from ['"]zod['"]/);
  });
});
