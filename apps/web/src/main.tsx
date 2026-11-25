import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ConfigErrorScreen } from './app/config-error';
import { AppProviders } from './app/providers';
import { router } from './app/router';
import { checkEnv } from './lib/env';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root ausente');

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
  </StrictMode>
);

// A página chegou desenhada do build (sub-projeto 18, E1) e o public/theme-init.js decidiu que esse HTML vale (E3):
// o React só hidrata. Senão (com sessão, no app instalado, no retorno de login ou na casca do app), desenha do zero;
// o conteúdo gerado, que o <style> do index.html já escondia, sai antes.
const prerendered = root.dataset.prerenderedRoute !== undefined;
if (config.ok && prerendered && document.documentElement.dataset.boot === 'static') {
  hydrateRoot(root, app, {
    onRecoverableError: (error) => console.error('Erro na hidratação do HTML estático:', error),
  });
} else {
  if (prerendered) {
    root.replaceChildren();
    delete root.dataset.prerenderedRoute;
  }
  createRoot(root).render(app);
}
