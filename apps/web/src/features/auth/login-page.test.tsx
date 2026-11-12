import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fakeApi, fakeGateway, signedIn } from '../../test/fakes';
import { renderApp } from '../../test/render';
import { LoginPage } from './login-page';

const home = <p>Painel</p>;

describe('LoginPage', () => {
  it('mostra erro traduzido quando o login falha', async () => {
    const { gateway } = fakeGateway(null);
    gateway.signInWithPassword.mockRejectedValueOnce(new Error('Invalid login credentials'));
    renderApp(<LoginPage />, { gateway, route: '/entrar', path: '/entrar', extraRoutes: { '/': home } });
    await userEvent.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-errada');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('valida e-mail e senha antes de chamar o provedor', async () => {
    const { gateway } = fakeGateway(null);
    renderApp(<LoginPage />, { gateway, route: '/entrar', path: '/entrar' });
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(gateway.signInWithPassword).not.toHaveBeenCalled();
  });

  it('entra e vai para o painel', async () => {
    const { gateway } = fakeGateway(null);
    renderApp(<LoginPage />, { gateway, route: '/entrar', path: '/entrar', extraRoutes: { '/': home } });
    await userEvent.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-segura');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Painel')).toBeInTheDocument();
  });

  it('"Experimentar sem cadastro" entra como anônimo, gera a demo uma vez e trava o botão durante a chamada', async () => {
    const { gateway } = fakeGateway(null);
    let release: () => void = () => {};
    const api = fakeApi({ 'POST /demo/seed': () => new Promise((r) => (release = () => r({ seeded: true }))) });
    renderApp(<LoginPage />, { gateway, api, route: '/entrar', path: '/entrar', extraRoutes: { '/': home } });
    const button = await screen.findByRole('button', { name: /Experimentar sem cadastro/ });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(button).toBeDisabled();
    release();
    expect(await screen.findByText('Painel')).toBeInTheDocument();
    expect(gateway.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/demo/seed', undefined);
  });

  it('se a geração da demo falhar, tentar de novo reaproveita o mesmo usuário anônimo', async () => {
    const { gateway } = fakeGateway(null);
    let attempts = 0;
    const api = fakeApi({ 'POST /demo/seed': () => (++attempts === 1 ? new Error('Falha temporária') : { seeded: true }) });
    renderApp(<LoginPage />, { gateway, api, route: '/entrar', path: '/entrar', extraRoutes: { '/': home } });
    const button = await screen.findByRole('button', { name: /Experimentar sem cadastro/ });

    await userEvent.click(button);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(button);

    expect(await screen.findByText('Painel')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(gateway.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('com sessão de usuário cadastrado, a demo ainda entra como anônimo (não gera demo na conta real)', async () => {
    const { gateway } = fakeGateway(signedIn(false));
    const api = fakeApi({ 'POST /demo/seed': { seeded: true } });
    renderApp(<LoginPage />, { gateway, api, route: '/entrar', path: '/entrar', extraRoutes: { '/': home } });
    await userEvent.click(await screen.findByRole('button', { name: /Experimentar sem cadastro/ }));
    expect(await screen.findByText('Painel')).toBeInTheDocument();
    expect(gateway.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('cria conta e avisa para confirmar o e-mail', async () => {
    const { gateway } = fakeGateway(null);
    renderApp(<LoginPage />, { gateway, route: '/entrar?modo=cadastro', path: '/entrar' });
    await userEvent.type(await screen.findByLabelText('Nome'), 'Ana Lúcia');
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-segura');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    await waitFor(() => expect(gateway.signUp).toHaveBeenCalledWith('ana@exemplo.com', 'senha-segura', 'Ana Lúcia'));
    expect(await screen.findByText(/Enviamos um link de confirmação/)).toBeInTheDocument();
  });
});

describe('RequireAuth', () => {
  it('redireciona para /entrar sem sessão e mostra o conteúdo com sessão', async () => {
    const { RequireAuth } = await import('./require-auth');
    const { gateway } = fakeGateway(null);
    renderApp(<RequireAuth><p>Segredo</p></RequireAuth>, { gateway, route: '/contas', path: '/contas', extraRoutes: { '/entrar': <p>Tela de entrada</p> } });
    expect(await screen.findByText('Tela de entrada')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});

describe('LoginPage — privacidade', () => {
  it('avisa a idade mínima e liga para os termos e a política de privacidade', async () => {
    renderApp(<LoginPage />, { gateway: fakeGateway(null).gateway, route: '/entrar', path: '/entrar' });
    expect(await screen.findByText(/declara ter 18 anos ou mais/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', '/termos');
    expect(screen.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute('href', '/privacidade');
  });
});
