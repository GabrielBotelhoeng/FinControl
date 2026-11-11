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
});
