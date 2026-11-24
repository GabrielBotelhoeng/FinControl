import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../features/auth/auth-context';
import { AuthLoading, ToLogin } from '../features/auth/require-auth';
import { useDemoStart } from '../features/auth/use-start-demo';
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
  const demo = useDemoStart();
  if (status === 'loading') return <AuthLoading />;
  // A demo começou pelo site: o login anônimo já abriu a sessão, mas o site fica até os dados existirem. Se a geração
  // falhar, ele continua com o erro e o botão de tentar de novo, em vez de abrir um painel vazio.
  const demoInProgress = demo.status !== 'idle' && pathname === '/';
  if (status === 'signed-in' && !demoInProgress) return <AppShell />;
  if (status === 'signed-out' && pathname !== '/') return <ToLogin />;
  if (status === 'signed-out' && isStandalone()) return <Navigate to="/entrar" replace />;
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SitePage />
    </Suspense>
  );
}
