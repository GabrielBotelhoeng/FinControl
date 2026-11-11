import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type AuthUser = { id: string; email: string | null; isAnonymous: boolean };
export type AuthSession = { user: AuthUser; accessToken: string };

/** Fronteira com o provedor de identidade. O app só conhece esta interface; os testes usam um fake. */
export interface AuthGateway {
  getSession(): Promise<AuthSession | null>;
  onChange(cb: (s: AuthSession | null) => void): () => void;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle(): Promise<void>;
  signInAnonymously(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
}

const toSession = (s: Session | null): AuthSession | null =>
  s ? { accessToken: s.access_token, user: { id: s.user.id, email: s.user.email ?? null, isAnonymous: s.user.is_anonymous ?? false } } : null;

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function createSupabaseGateway(client: SupabaseClient): AuthGateway {
  return {
    async getSession() {
      const { data } = await client.auth.getSession();
      return toSession(data.session);
    },
    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(toSession(session)));
      return () => data.subscription.unsubscribe();
    },
    async signInWithPassword(email, password) {
      check((await client.auth.signInWithPassword({ email, password })).error);
    },
    async signUp(email, password, name) {
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: name } } });
      check(error);
      return { needsConfirmation: !data.session };
    },
    async signInWithGoogle() {
      check((await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })).error);
    },
    async signInAnonymously() {
      check((await client.auth.signInAnonymously()).error);
    },
    async resetPassword(email) {
      check((await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/perfil` })).error);
    },
    async signOut() {
      check((await client.auth.signOut()).error);
    },
  };
}

const AUTH_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Já existe uma conta com este e-mail. Tente entrar.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada.',
};

export function translateAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  return AUTH_MESSAGES[message] ?? 'Não foi possível concluir agora. Tente novamente em instantes.';
}
