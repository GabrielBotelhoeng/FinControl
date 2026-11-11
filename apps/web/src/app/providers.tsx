import { createClient } from '@supabase/supabase-js';
import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '../features/auth/auth-context';
import { createSupabaseGateway } from '../features/auth/gateway';
import { createApiClient } from '../lib/api-client';
import { ApiProvider } from '../lib/api-context';
import { readEnv } from '../lib/env';
import { createQueryClient } from '../lib/query-client';
import { ThemeProvider } from './theme';

const env = readEnv();
const gateway = createSupabaseGateway(createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY));
const queryClient = createQueryClient();

function ApiFromAuth({ children }: { children: ReactNode }) {
  const { getToken, signOut } = useAuth();
  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: env.VITE_API_URL,
        getToken,
        // Sessão expirada: sai uma vez e deixa o RequireAuth levar para /entrar.
        onUnauthorized: () => {
          queryClient.clear();
          void signOut();
        },
      }),
    [getToken, signOut],
  );
  return <ApiProvider client={client}>{children}</ApiProvider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider gateway={gateway}>
          <ApiFromAuth>
            {children}
            <Toaster position="top-center" theme="system" toastOptions={{ className: 'font-sans' }} />
          </ApiFromAuth>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
