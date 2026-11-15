import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../features/auth/auth-context';
import { fakeGateway, signedIn } from '../test/fakes';
import { ClearCacheOnUserChange } from './providers';

describe('ClearCacheOnUserChange', () => {
  it('limpa o cache quando a pessoa sai ou quando entra outra conta, para nada de um usuário aparecer para o próximo', async () => {
    const queryClient = new QueryClient();
    const { gateway, emit } = fakeGateway(signedIn());
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider gateway={gateway}>
          <ClearCacheOnUserChange queryClient={queryClient} />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(gateway.getSession).toHaveBeenCalled());

    // Mesma pessoa (renovação de token): o cache fica.
    queryClient.setQueryData(['loans'], [{ id: 'l1' }]);
    act(() => emit({ ...signedIn(), accessToken: 'outro-token' }));
    expect(queryClient.getQueryData(['loans'])).toEqual([{ id: 'l1' }]);

    // Saiu: o cache vai embora.
    act(() => emit(null));
    await waitFor(() => expect(queryClient.getQueryData(['loans'])).toBeUndefined());

    // Entrou outra conta com dados em cache de antes: também limpa.
    queryClient.setQueryData(['loans'], [{ id: 'l1' }]);
    act(() => emit({ accessToken: 't2', user: { id: 'u9', email: 'bia@exemplo.com', isAnonymous: false } }));
    await waitFor(() => expect(queryClient.getQueryData(['loans'])).toBeUndefined());
  });
});
