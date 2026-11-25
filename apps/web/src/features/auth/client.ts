import { GoTrueClient } from '@supabase/auth-js';

/**
 * Chave da sessão no localStorage, montada como o supabase-js montava (`sb-<ref>-auth-token`). Se mudar, todo mundo
 * que está logado é deslogado (sub-projeto 18, E9).
 */
export function authStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

/**
 * Só o cliente do Auth (o app usa o Supabase apenas para o login): as mesmas opções, a mesma chave e os mesmos
 * cabeçalhos que o `createClient` do supabase-js passava, sem carregar o postgrest, o storage e o realtime.
 */
export function createAuthClient(supabaseUrl: string, anonKey: string): GoTrueClient {
  return new GoTrueClient({
    url: new URL('auth/v1', supabaseUrl.endsWith('/') ? supabaseUrl : `${supabaseUrl}/`).href,
    headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
    storageKey: authStorageKey(supabaseUrl),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  });
}
