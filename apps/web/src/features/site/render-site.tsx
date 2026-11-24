import { screen } from '@testing-library/react';
import { renderApp } from '../../test/render';
import SitePage from './site-page';

type Options = Parameters<typeof renderApp>[1];

/**
 * Renderiza o site inteiro de uma vez. Na página real, depois do herói as seções entram uma por quadro, a não ser que
 * a URL chegue com uma âncora (site-page.tsx); os testes usam esse caminho para não depender de tempo.
 */
export async function renderSitePage(opts: Options = {}) {
  window.history.replaceState(null, '', '/#conteudo');
  const result = renderApp(<SitePage />, { route: '/', path: '/', extraRoutes: { '/entrar': <p>Entrada</p> }, ...opts });
  window.history.replaceState(null, '', '/');
  await screen.findByRole('contentinfo');
  return result;
}
