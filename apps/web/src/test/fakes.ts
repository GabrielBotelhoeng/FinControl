import { vi } from 'vitest';
import type { ApiClient } from '../lib/api-client';
import type { AuthGateway, AuthSession } from '../features/auth/gateway';

export function fakeGateway(initial: AuthSession | null = null) {
  let session = initial;
  const listeners = new Set<(s: AuthSession | null) => void>();
  const emit = (s: AuthSession | null) => {
    session = s;
    listeners.forEach((l) => l(s));
  };
  const gateway = {
    getSession: vi.fn(async () => session),
    onChange: vi.fn((cb: (s: AuthSession | null) => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    }),
    signInWithPassword: vi.fn(async () => emit({ accessToken: 't', user: { id: 'u1', email: 'ana@exemplo.com', isAnonymous: false } })),
    signUp: vi.fn(async () => ({ needsConfirmation: true })),
    signInWithGoogle: vi.fn(async () => {}),
    signInAnonymously: vi.fn(async () => emit({ accessToken: 't', user: { id: 'u2', email: null, isAnonymous: true } })),
    resetPassword: vi.fn(async () => {}),
    signOut: vi.fn(async () => emit(null)),
  } satisfies AuthGateway;
  return { gateway, emit };
}

export const signedIn = (isAnonymous = false): AuthSession => ({
  accessToken: 'tok',
  user: { id: 'u1', email: isAnonymous ? null : 'ana@exemplo.com', isAnonymous },
});

type Handler = (path: string, body?: unknown, query?: unknown) => unknown;

/** ApiClient falso: rotas por "MÉTODO /caminho" (prefixo); sem rota lança erro para o teste falhar alto. */
export function fakeApi(routes: Record<string, Handler | unknown> = {}) {
  const find = (method: string, path: string) => {
    const key = Object.keys(routes)
      .filter((k) => {
        const [m, p] = k.split(' ');
        return m === method && p !== undefined && path.startsWith(p);
      })
      .sort((a, b) => b.length - a.length)[0];
    if (!key) throw new Error(`Rota não mapeada no fakeApi: ${method} ${path}`);
    return routes[key];
  };
  const call = async (method: string, path: string, body?: unknown, query?: unknown) => {
    const handler = find(method, path);
    const result = typeof handler === 'function' ? await (handler as Handler)(path, body, query) : handler;
    if (result instanceof Error) throw result;
    return result;
  };
  const api = {
    get: vi.fn((path: string, query?: unknown) => call('GET', path, undefined, query)),
    post: vi.fn((path: string, body?: unknown) => call('POST', path, body)),
    patch: vi.fn((path: string, body: unknown) => call('PATCH', path, body)),
    del: vi.fn(async (path: string) => {
      await call('DELETE', path);
    }),
  };
  return api as typeof api & ApiClient;
}
