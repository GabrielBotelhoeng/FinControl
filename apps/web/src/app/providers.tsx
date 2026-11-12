import { createClient } from '@supabase/supabase-js';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '../features/auth/auth-context';
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

/** Recebe a configuração já validada (main.tsx) e cria os serviços uma única vez. */
export function AppProviders({ env, children }: { env: WebEnv; children: ReactNode }) {
  const [{ gateway, queryClient }] = useState(() => ({
    gateway: createSupabaseGateway(createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)),
    queryClient: createQueryClient(),
  }));
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider gateway={gateway}>
          <ApiFromAuth baseUrl={env.VITE_API_URL} queryClient={queryClient}>
            {children}
            <Toaster position="top-center" theme="system" toastOptions={{ className: 'font-sans' }} />
          </ApiFromAuth>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
