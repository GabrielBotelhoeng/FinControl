import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi, fakeGateway } from '../../test/fakes';
import { renderApp } from '../../test/render';
import SitePage, { SITE_TITLE } from './site-page';

const routes = { '/entrar': <p>Tela de entrada</p>, '/painel': <p>Painel</p> };

describe('SitePage', () => {
  it('tem os marcos da página, um h1 só e o título próprio', async () => {
    renderApp(<SitePage />, { gateway: fakeGateway(null).gateway, route: '/', path: '/', extraRoutes: routes });
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe(SITE_TITLE);
  });

  it('o cabeçalho liga as âncoras das seções e a entrada', () => {
    renderApp(<SitePage />, { gateway: fakeGateway(null).gateway, route: '/', path: '/', extraRoutes: routes });
    const nav = screen.getByRole('navigation', { name: 'Seções do site' });
    expect(within(nav).getByRole('link', { name: 'Planos' })).toHaveAttribute('href', '#planos');
    expect(document.getElementById('planos')).not.toBeNull();
    expect(document.getElementById('recursos')).not.toBeNull();
    expect(document.getElementById('perguntas')).not.toBeNull();
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
  });

  it('"Experimentar" do cabeçalho abre a demo', async () => {
    const { gateway } = fakeGateway(null);
    const api = fakeApi({ 'POST /demo/seed': { seeded: true } });
    renderApp(<SitePage />, { gateway, api, route: '/', path: '/', extraRoutes: routes });
    await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: /Experimentar/ }));
    expect(gateway.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/demo/seed', undefined);
  });
});
