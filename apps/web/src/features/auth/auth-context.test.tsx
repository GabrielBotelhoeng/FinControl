import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fakeGateway, signedIn } from '../../test/fakes';
import { AuthProvider, useAuth } from './auth-context';

let auth: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  return null;
}

describe('AuthProvider', () => {
  it('sai mesmo quando o provedor falha no logout (token expirado)', async () => {
    const { gateway } = fakeGateway(signedIn());
    gateway.signOut.mockRejectedValueOnce(new Error('Invalid JWT'));
    render(<AuthProvider gateway={gateway}><Probe /></AuthProvider>);
    await waitFor(() => expect(auth.status).toBe('signed-in'));
    await act(async () => {
      await auth.signOut();
    });
    expect(auth.status).toBe('signed-out');
  });

  it('sair apaga a conversa do assistente da aba (A6)', async () => {
    sessionStorage.setItem('fincontrol:assistente:u1', '[]');
    sessionStorage.setItem('outra-coisa', 'fica');
    const { gateway } = fakeGateway(signedIn());
    render(<AuthProvider gateway={gateway}><Probe /></AuthProvider>);
    await waitFor(() => expect(auth.status).toBe('signed-in'));
    await act(async () => {
      await auth.signOut();
    });
    expect(sessionStorage.getItem('fincontrol:assistente:u1')).toBeNull();
    expect(sessionStorage.getItem('outra-coisa')).toBe('fica');
    sessionStorage.clear();
  });
});
