import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './app/theme';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root ausente');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <main className="aurora grid min-h-dvh place-items-center p-6">
        <h1 className="font-display text-5xl tracking-tight">
          <span className="font-extralight">Fin</span>
          <span className="font-extrabold">Control</span>
        </h1>
      </main>
    </ThemeProvider>
  </StrictMode>,
);
