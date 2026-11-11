import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ConfigErrorScreen } from './app/config-error';
import { AppProviders } from './app/providers';
import { router } from './app/router';
import { checkEnv } from './lib/env';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root ausente');

const config = checkEnv();

createRoot(root).render(
  <StrictMode>
    {config.ok ? (
      <AppProviders env={config.env}>
        <RouterProvider router={router} />
      </AppProviders>
    ) : (
      <ConfigErrorScreen fields={config.fields} />
    )}
  </StrictMode>,
);
