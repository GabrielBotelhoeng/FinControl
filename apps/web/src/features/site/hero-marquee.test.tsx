import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi, fakeGateway } from '../../test/fakes';
import { renderApp } from '../../test/render';
import { MARQUEE_ITEMS } from './marquee';
import SitePage from './site-page';

const routes = { '/entrar': <p>Tela de entrada</p> };

describe('herói e faixa do site', () => {
  it('o h1 e o botão principal estão no primeiro quadro', () => {
    renderApp(<SitePage />, { gateway: fakeGateway(null).gateway, route: '/', path: '/', extraRoutes: routes });
    expect(screen.getByRole('heading', { level: 1, name: 'Seu dinheiro, sob controle.' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Experimentar sem cadastro' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Criar conta grátis/ })).toHaveAttribute('href', '/entrar?modo=cadastro');
    expect(screen.getAllByText(/declara ter 18 anos ou mais/)).toHaveLength(1);
  });

  it('"Experimentar sem cadastro" abre a demo uma vez só', async () => {
    const { gateway } = fakeGateway(null);
    const api = fakeApi({ 'POST /demo/seed': { seeded: true } });
    renderApp(<SitePage />, { gateway, api, route: '/', path: '/', extraRoutes: routes });
    await userEvent.click(screen.getByRole('button', { name: 'Experimentar sem cadastro' }));
    expect(gateway.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('a faixa é lida uma vez: a cópia que fecha o laço fica escondida do leitor de tela', () => {
    renderApp(<SitePage />, { gateway: fakeGateway(null).gateway, route: '/', path: '/', extraRoutes: routes });
    const strip = screen.getByRole('region', { name: 'O que o FinControl faz' });
    const lists = strip.querySelectorAll('ul');
    expect(lists).toHaveLength(2);
    expect(lists[1]).toHaveAttribute('aria-hidden', 'true');
    for (const item of MARQUEE_ITEMS) expect(within(lists[0] as HTMLElement).getByText(item)).toBeInTheDocument();
  });
});
