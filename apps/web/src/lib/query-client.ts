import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Erro do cliente (4xx) não melhora tentando de novo; rede e 5xx ganham uma nova tentativa.
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
      },
    },
  });
}
