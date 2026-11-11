import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useFinanceMutation } from './api';

describe('useFinanceMutation', () => {
  it('refaz a busca quando a mutação termina durante o primeiro carregamento da lista', async () => {
    // Corrida real (vista no E2E): a lista começa a carregar, o usuário cria um item, e a resposta
    // antiga (sem o item) chega depois do POST. A lista precisa buscar de novo, não aproveitar a antiga.
    let releaseStale: (rows: string[]) => void = () => {};
    let calls = 0;
    const queryFn = () => {
      calls += 1;
      return calls === 1 ? new Promise<string[]>((resolve) => (releaseStale = resolve)) : Promise.resolve(['nova conta']);
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

    let saved = false;
    const { result } = renderHook(
      () => ({
        list: useQuery({ queryKey: ['accounts'], queryFn }),
        save: useFinanceMutation(async () => {
          saved = true;
          return 'ok';
        }),
      }),
      { wrapper },
    );
    await waitFor(() => expect(calls).toBe(1));

    let mutation: Promise<unknown> = Promise.resolve();
    act(() => {
      mutation = result.current.save.mutateAsync(undefined);
    });
    await waitFor(() => expect(saved).toBe(true));
    act(() => releaseStale([]));
    await act(() => mutation);

    await waitFor(() => expect(result.current.list.data).toEqual(['nova conta']));
  });
});
