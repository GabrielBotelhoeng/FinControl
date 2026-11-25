import { describe, expect, it } from 'vitest';
import { authStorageKey, createAuthClient } from './client';

const PROD_URL = 'https://ojywswdjhjmwnfhalntl.supabase.co';

// Campos internos do AuthClient conferidos aqui (não fazem parte dos tipos públicos).
type Internals = {
  storageKey: string;
  url: string;
  headers: Record<string, string>;
  persistSession: boolean;
  autoRefreshToken: boolean;
  detectSessionInUrl: boolean;
  flowType: string;
};

describe('cliente de login com o auth-js (sub-projeto 18, E9)', () => {
  it('guarda a sessão na mesma chave que o supabase-js usava (senão todo mundo logado seria deslogado)', () => {
    expect(authStorageKey(PROD_URL)).toBe('sb-ojywswdjhjmwnfhalntl-auth-token');
    expect(authStorageKey('http://localhost:54399')).toBe('sb-localhost-auth-token');
    const client = createAuthClient(PROD_URL, 'chave-anon') as unknown as Internals;
    expect(client.storageKey).toBe('sb-ojywswdjhjmwnfhalntl-auth-token');
  });

  it('fala com o /auth/v1 do projeto, com os mesmos cabeçalhos e opções do supabase-js', () => {
    const client = createAuthClient(`${PROD_URL}/`, 'chave-anon') as unknown as Internals;
    expect(client.url).toBe(`${PROD_URL}/auth/v1`);
    expect(client.headers.apikey).toBe('chave-anon');
    expect(client.headers.Authorization).toBe('Bearer chave-anon');
    expect(client.persistSession).toBe(true);
    expect(client.autoRefreshToken).toBe(true);
    expect(client.detectSessionInUrl).toBe(true);
    expect(client.flowType).toBe('implicit');
  });
});
