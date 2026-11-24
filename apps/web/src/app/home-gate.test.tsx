import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, fakeGateway, signedIn } from '../test/fakes';
import { renderApp } from '../test/render';
import { HomeGate } from './home-gate';

const login = { '/entrar': <p>Tela de entrada</p> };

describe('HomeGate', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sem sessão, a / mostra o site de apresentação', async () => {
    renderApp(<HomeGate />, { gateway: fakeGateway(null).gateway, route: '/', path: '/*', extraRoutes: login });
    // O site é um pedaço `lazy` com o Motion: sob a suíte inteira, o import pode passar de 1 s.
    expect(await screen.findByRole('heading', { level: 1, name: /Seu dinheiro, sob controle/ }, { timeout: 5000 })).toBeInTheDocument();
  });

  it('com sessão, a / mostra o app', async () => {
    renderApp(<HomeGate />, { gateway: fakeGateway(signedIn()).gateway, route: '/', path: '/*', extraRoutes: login });
    expect((await screen.findAllByRole('link', { name: 'Painel' })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { level: 1, name: /sob controle/ })).not.toBeInTheDocument();
  });

  it('sem sessão em outra rota, vai para a entrada', async () => {
    renderApp(<HomeGate />, { gateway: fakeGateway(null).gateway, route: '/lancamentos', path: '/*', extraRoutes: login });
    expect(await screen.findByText('Tela de entrada')).toBeInTheDocument();
  });

  it('no app instalado (standalone) sem sessão, a / vai para a entrada', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ matches: query === '(display-mode: standalone)', media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
    );
    renderApp(<HomeGate />, { gateway: fakeGateway(null).gateway, route: '/', path: '/*', extraRoutes: login });
    expect(await screen.findByText('Tela de entrada')).toBeInTheDocument();
  });

  it('demo pelo site: se o seed falha depois do login anônimo, o site fica com o erro, e tentar de novo abre o painel', async () => {
    const { gateway } = fakeGateway(null);
    let attempts = 0;
    const api = fakeApi({ 'POST /demo/seed': () => (++attempts === 1 ? new Error('Falha temporária') : { seeded: true }) });
    renderApp(<HomeGate />, { gateway, api, route: '/', path: '/*', extraRoutes: login });
    const hero = await screen.findByRole('region', { name: 'Seu dinheiro, sob controle.' }, { timeout: 5000 });

    await userEvent.click(within(hero).getByRole('button', { name: 'Experimentar sem cadastro' }));
    // O anônimo já entrou, mas o site continua, com o erro, em vez do painel vazio.
    expect(await within(hero).findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Seu dinheiro, sob controle.' })).toBeInTheDocument();
    expect(screen.queryAllByRole('link', { name: 'Painel' })).toHaveLength(0);

    await userEvent.click(within(hero).getByRole('button', { name: 'Experimentar sem cadastro' }));
    expect((await screen.findAllByRole('link', { name: 'Painel' })).length).toBeGreaterThan(0);
    expect(gateway.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledTimes(2);
  });
});
