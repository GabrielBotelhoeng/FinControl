import { StrictMode, useEffect } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ConfigErrorScreen } from './app/config-error';
import { AppProviders } from './app/providers';
import { router } from './app/router';
import { preloadPublicPage } from './app/routes';
import { checkEnv } from './lib/env';
import { retrying } from './lib/preloadable';
import { PUBLIC_HEAD, type PublicPath } from './lib/public-head';

/** Esperas (ms) entre as tentativas de carregar o pedaço da página antes de hidratar. */
const RETRY_DELAYS = [1000, 3000];

/** Marca o `<html>` quando o app terminou de montar ou de hidratar (`data-app-ready`): os testes E2E esperam por ela. */
function AppReady() {
  useEffect(() => {
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
    try {
      await retrying(() => preloadPublicPage(path as PublicPath), RETRY_DELAYS);
    } catch {
      // Sem o pedaço da página (rede): o HTML estático continua na tela, com os links funcionando, e o app só assume
      // quando a conexão voltar. Hidratar sem ele faria o lazy cair no erro (CodeRabbit).
      await new Promise((online) => window.addEventListener('online', online, { once: true }));
      return boot(root, hydrate);
    }
    hydrateRoot(root, app, { onRecoverableError: (error) => console.error('Erro na hidratação do HTML estático:', error) });
    return;
  }
  if (path !== undefined) {
    root.replaceChildren();
    delete root.dataset.prerenderedRoute;
  }
  createRoot(root).render(app);
}
