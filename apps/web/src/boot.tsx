import { StrictMode, useEffect } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ConfigErrorScreen } from './app/config-error';
import { AppProviders } from './app/providers';
import { router } from './app/router';
import { preloadPublicPage } from './app/routes';
import { checkEnv } from './lib/env';
import { retrying } from './lib/preloadable';
import { clearReloadGuard } from './lib/pwa-update';
import { PUBLIC_HEAD, type PublicPath } from './lib/public-head';

/**
 * Esperas (ms) entre as tentativas de carregar o pedaço da página antes de hidratar: crescentes, até 30 s, uns 2 minutos
 * no total. Depois disso o boot desiste, e o main.tsx solta os toques guardados (CodeRabbit, PR #40).
 */
export const BOOT_RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000, 30000, 30000];

/**
 * O que encurta a espera entre tentativas: a conexão voltar, a pessoa voltar para a aba ou tocar na página. Nenhum deles é
 * necessário (a espera acaba sozinha); um toque com o aparelho sem conexão (`navigator.onLine`) não gasta tentativa.
 */
function wakeOnActivity(root: HTMLElement) {
  return (now: () => void) => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') now();
    };
    const onTouch = () => {
      if (navigator.onLine) now();
    };
    window.addEventListener('online', now);
    document.addEventListener('visibilitychange', onVisible);
    root.addEventListener('click', onTouch, true);
    return () => {
      window.removeEventListener('online', now);
      document.removeEventListener('visibilitychange', onVisible);
      root.removeEventListener('click', onTouch, true);
    };
  };
}

/**
 * Marca o `<html>` quando o app terminou de montar ou de hidratar (`data-app-ready`): os testes E2E esperam por ela. Também
 * tira a trava da recarga única do main.tsx (sub-projeto 19, A4): o boot deu certo.
 */
function AppReady() {
  useEffect(() => {
    clearReloadGuard();
    document.documentElement.dataset.appReady = 'true';
  }, []);
  return null;
}

/**
 * Monta o app no `#root` (carregado pelo main.tsx). Com `hydrate`, a página chegou desenhada do build e o
 * public/theme-init.js decidiu que esse HTML vale (sub-projeto 18, E1 e E3): o React só hidrata, depois de carregar o
 * pedaço da página (senão a parte em `lazy` ficaria desidratada e seria redesenhada do zero). Senão (com sessão, no app
 * instalado, no retorno de login ou na casca do app), desenha do zero; o conteúdo gerado, que o <style> do index.html
 * já escondia, sai antes.
 */
export async function boot(root: HTMLElement, hydrate: boolean) {
  const config = checkEnv();
  const app = (
    <StrictMode>
      {config.ok ? (
        <AppProviders env={config.env}>
          <RouterProvider router={router} />
        </AppProviders>
      ) : (
        <ConfigErrorScreen fields={config.fields} />
      )}
      <AppReady />
    </StrictMode>
  );
  const path = root.dataset.prerenderedRoute;
  if (hydrate && config.ok && path && path in PUBLIC_HEAD) {
    // Sem o pedaço da página (rede, servidor): o HTML estático continua na tela, com os links funcionando, e o app só
    // assume quando ele chegar (hidratar sem ele faria o lazy cair no erro). Se nenhuma tentativa der certo, o erro sobe
    // para o main.tsx, que solta os toques guardados (CodeRabbit, PR #40).
    await retrying(() => preloadPublicPage(path as PublicPath), BOOT_RETRY_DELAYS, wakeOnActivity(root));
    hydrateRoot(root, app, { onRecoverableError: (error) => console.error('Erro na hidratação do HTML estático:', error) });
    return;
  }
  if (path !== undefined) {
    root.replaceChildren();
    delete root.dataset.prerenderedRoute;
  }
  createRoot(root).render(app);
}
