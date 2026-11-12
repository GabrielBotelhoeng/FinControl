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
});
