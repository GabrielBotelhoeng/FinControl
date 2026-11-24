import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../features/auth/auth-context';
import { AuthLoading, ToLogin } from '../features/auth/require-auth';
import { AppShell } from './app-shell';

// O site e a biblioteca de animação ficam num pedaço separado do bundle (sub-projeto 17, S3).
const SitePage = lazy(() => import('../features/site/site-page'));

/** App instalado (PWA): quem abre pela tela inicial quer entrar, não ler a apresentação (S2). */
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/**
 * Portão da `/` (sub-projeto 17, S1): com sessão, o app (o painel e as rotas filhas); sem sessão na `/`, o site de
 * apresentação (ou a entrada, no app instalado); sem sessão em qualquer outra rota, a entrada, como no `RequireAuth`.
 */
export function HomeGate() {
  const { status } = useAuth();
  const { pathname } = useLocation();
  if (status === 'loading') return <AuthLoading />;
  if (status === 'signed-in') return <AppShell />;
  if (pathname !== '/') return <ToLogin />;
  if (isStandalone()) return <Navigate to="/entrar" replace />;
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SitePage />
    </Suspense>
  );
}
