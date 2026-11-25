import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, fakeGateway, signedIn } from '../test/fakes';
import { renderApp } from '../test/render';
import { LoginPage } from '../features/auth/login-page';
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
    // O AppShell é um pedaço `lazy`: sob a suíte inteira, o import pode passar de 1 s (QA).
    expect((await screen.findAllByRole('link', { name: 'Painel' }, { timeout: 5000 })).length).toBeGreaterThan(0);
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
    expect((await screen.findAllByRole('link', { name: 'Painel' }, { timeout: 5000 })).length).toBeGreaterThan(0);
    expect(gateway.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  it('demo que falhou na entrada não segura o site: depois de entrar com senha, a / mostra o painel', async () => {
    const { gateway } = fakeGateway(null);
    const api = fakeApi({ 'POST /demo/seed': () => new Error('Falha temporária') });
    renderApp(<LoginPage />, { gateway, api, route: '/entrar', path: '/entrar', extraRoutes: { '/*': <HomeGate /> } });

    await userEvent.click(await screen.findByRole('button', { name: /Experimentar sem cadastro/ }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-segura');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect((await screen.findAllByRole('link', { name: 'Painel' }, { timeout: 5000 })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { level: 1, name: 'Seu dinheiro, sob controle.' })).not.toBeInTheDocument();
  });

  it('na volta do link de confirmação (?token_hash=…&type=signup), sem sessão guardada, a / não desenha o site enquanto carrega', async () => {
    const { gateway } = fakeGateway(null);
    gateway.getSession.mockImplementation(() => new Promise(() => {})); // a sessão ainda está sendo conferida
    window.history.replaceState(null, '', '/?token_hash=x&type=signup');
    try {
      renderApp(<HomeGate />, { gateway, route: '/', path: '/*', extraRoutes: login });
      expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 300));
      expect(screen.queryByRole('heading', { level: 1, name: 'Seu dinheiro, sob controle.' })).not.toBeInTheDocument();
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('sem retorno de login e sem sessão guardada, a / já desenha o site enquanto a sessão é conferida', async () => {
    const { gateway } = fakeGateway(null);
    gateway.getSession.mockImplementation(() => new Promise(() => {}));
    renderApp(<HomeGate />, { gateway, route: '/', path: '/*', extraRoutes: login });
    expect(await screen.findByRole('heading', { level: 1, name: 'Seu dinheiro, sob controle.' }, { timeout: 5000 })).toBeInTheDocument();
  });
});
