import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../features/auth/auth-context';
import { AuthLoading, ToLogin } from '../features/auth/require-auth';
import { useDemoStart } from '../features/auth/use-start-demo';
import { preloadable } from '../lib/preloadable';

// O site e a biblioteca de animação ficam num pedaço separado do bundle (sub-projeto 17, S3). Pré-carregável: antes de
// hidratar o HTML estático da `/`, o boot.tsx carrega o pedaço (sub-projeto 18).
export const SitePage = preloadable(() => import('../features/site/site-page'));
// O app também é um pedaço próprio: quem vê o site não baixa o app (o formulário de lançamento, o react-hook-form…), e
// quem tem sessão recebe o modulepreload dele pelo public/theme-init.js, sem esperar (Lighthouse do site).
const AppShell = lazy(() => import('./app-shell').then((m) => ({ default: m.AppShell })));

/** No build (prerender do HTML estático, sub-projeto 18) não há navegador: a `/` é o site, sem sessão. */
const isServer = () => typeof window === 'undefined';

/** App instalado (PWA): quem abre pela tela inicial quer entrar, não ler a apresentação (S2). */
const isStandalone = () =>
  !isServer() &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

/** Há uma sessão do Supabase guardada neste navegador? (A mesma regra do `public/theme-init.js`.) */
function hasStoredSession(): boolean {
  if (isServer()) return false;
  try {
    for (let i = 0; i < localStorage.length; i++) if (/^sb-.+-auth-token$/.test(localStorage.key(i) ?? '')) return true;
    return false;
  } catch {
    return true; // Sem acesso ao armazenamento: não arrisca mostrar o site para quem pode estar logado.
  }
}

/** Parâmetros que o Supabase usa na volta para o app (login com Google, link de confirmação, erro). */
export const AUTH_RETURN_PARAMS = ['access_token', 'refresh_token', 'code', 'token_hash', 'type', 'error', 'error_code', 'error_description'];

/**
 * Volta de um login externo ou do link de confirmação de cadastro: a sessão chega pela URL (no hash ou na query), ainda
 * sem estar guardada. A mesma lista vale no `public/theme-init.js` (teste).
 */
const isAuthRedirect = () => {
  if (isServer()) return false;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  return AUTH_RETURN_PARAMS.some((p) => hash.has(p) || query.has(p));
};

/**
 * Portão da `/` (sub-projeto 17, S1): com sessão, o app (o painel e as rotas filhas); sem sessão na `/`, o site de
 * apresentação (ou a entrada, no app instalado); sem sessão em qualquer outra rota, a entrada, como no `RequireAuth`.
 */
export function HomeGate() {
  const { status, isDemo } = useAuth();
  const { pathname } = useLocation();
  const demo = useDemoStart();
  if (status === 'loading') {
    // Sem sessão guardada, a `/` já começa a desenhar o site enquanto o Supabase confere a sessão, em vez do esqueleto
    // (o LCP do site no celular). Se uma sessão aparecer, o portão troca para o app como sempre.
    const surelySignedOut = pathname === '/' && !isStandalone() && !hasStoredSession() && !isAuthRedirect();
    if (!surelySignedOut) return <AuthLoading />;
  }
  // A demo começou pelo site: o login anônimo já abriu a sessão, mas o site fica até os dados existirem. Se a geração
  // falhar, ele continua com o erro e o botão de tentar de novo, em vez de abrir um painel vazio.
  // A falha só segura o site se a sessão ainda for a anônima da demo: quem entrou com a própria conta vê o app.
  const demoInProgress = pathname === '/' && (demo.status === 'pending' || (demo.status === 'failed' && isDemo));
  if (status === 'signed-in' && !demoInProgress) {
    return (
      <Suspense fallback={<AuthLoading />}>
        <AppShell />
      </Suspense>
    );
  }
  if (status === 'signed-out' && pathname !== '/') return <ToLogin />;
  // (Com `status === 'loading'`, só chega aqui na `/` e fora do app instalado: cai no site.)
  if (status === 'signed-out' && isStandalone()) return <Navigate to="/entrar" replace />;
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SitePage />
    </Suspense>
  );
}
