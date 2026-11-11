import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthGateway, AuthSession, AuthUser } from './gateway';

type Status = 'loading' | 'signed-in' | 'signed-out';

type AuthContextValue = {
  status: Status;
  user: AuthUser | null;
  isDemo: boolean;
  gateway: AuthGateway;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ gateway, children }: { gateway: AuthGateway; children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    gateway.getSession().then((s) => active && setSession(s));
    const unsubscribe = gateway.onChange((s) => setSession(s));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [gateway]);

  const getToken = useCallback(async () => (await gateway.getSession())?.accessToken ?? null, [gateway]);
  const signOut = useCallback(async () => {
    await gateway.signOut();
    setSession(null);
  }, [gateway]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: session === undefined ? 'loading' : session ? 'signed-in' : 'signed-out',
      user: session?.user ?? null,
      isDemo: session?.user.isAnonymous ?? false,
      gateway,
      getToken,
      signOut,
    }),
    [session, gateway, getToken, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return ctx;
}
