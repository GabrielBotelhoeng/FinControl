import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Skeleton } from '../../components/ui/states';
import { useAuth } from './auth-context';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <div role="status" aria-label="Carregando" className="mx-auto grid max-w-5xl gap-4 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (status === 'signed-out') return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
