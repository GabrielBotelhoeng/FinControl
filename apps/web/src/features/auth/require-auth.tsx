import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Skeleton } from '../../components/ui/states';
import { useAuth } from './auth-context';

/** Esqueleto enquanto a sessão carrega (também usado pelo portão da página inicial). */
export function AuthLoading() {
  return (
    <div role="status" aria-label="Carregando" className="mx-auto grid max-w-5xl gap-4 p-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-40" />
      <Skeleton className="h-64" />
    </div>
  );
}

/** Sem sessão: vai para a entrada lembrando de onde veio. */
export function ToLogin() {
  const location = useLocation();
  return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <AuthLoading />;
  if (status === 'signed-out') return <ToLogin />;
  return <>{children}</>;
}
