import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '../features/auth/auth-context';
import { createAuthClient } from '../features/auth/client';
import { createSupabaseGateway } from '../features/auth/gateway';
import { createApiClient } from '../lib/api-client';
import { ApiProvider } from '../lib/api-context';
import type { WebEnv } from '../lib/env';
import { createQueryClient } from '../lib/query-client';
import { ThemeProvider } from './theme';

function ApiFromAuth({ baseUrl, queryClient, children }: { baseUrl: string; queryClient: QueryClient; children: ReactNode }) {
  const { getToken, signOut } = useAuth();
  const client = useMemo(
    () =>
      createApiClient({
        baseUrl,
        getToken,
        // Sessão expirada: sai uma vez e deixa o RequireAuth levar para /entrar.
        onUnauthorized: () => {
          queryClient.clear();
          void signOut();
        },
      }),
    [baseUrl, queryClient, getToken, signOut],
  );
  return <ApiProvider client={client}>{children}</ApiProvider>;
}

/**
 * Limpa o cache do React Query quando a identidade muda (saída ou outra conta na mesma aba). As chaves das
 * consultas não levam o usuário; sem isto, os dados de uma pessoa poderiam aparecer por um instante para a próxima.
 */
export function ClearCacheOnUserChange({ queryClient }: { queryClient: QueryClient }) {
  const { status, user } = useAuth();
  const identity = status === 'loading' ? undefined : (user?.id ?? null);
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (identity === undefined) return;
    if (previous.current !== undefined && previous.current !== identity) queryClient.clear();
    previous.current = identity;
  }, [identity, queryClient]);
  return null;
}

/** Recebe a configuração já validada (main.tsx) e cria os serviços uma única vez. */
export function AppProviders({ env, children }: { env: WebEnv; children: ReactNode }) {
  const [{ gateway, queryClient }] = useState(() => ({
    gateway: createSupabaseGateway(createAuthClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)),
    queryClient: createQueryClient(),
  }));
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider gateway={gateway}>
          <ClearCacheOnUserChange queryClient={queryClient} />
          <ApiFromAuth baseUrl={env.VITE_API_URL} queryClient={queryClient}>
            {children}
            <Toaster position="top-center" theme="system" toastOptions={{ className: 'font-sans' }} />
          </ApiFromAuth>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
