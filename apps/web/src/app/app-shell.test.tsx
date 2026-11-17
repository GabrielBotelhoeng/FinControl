import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi, fakeGateway, signedIn } from '../test/fakes';
import { renderApp } from '../test/render';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  it('marca o item ativo com aria-current="page" nas duas navegações', async () => {
    renderApp(<AppShell />, { route: '/contas', path: '/*' });
    const current = await screen.findAllByRole('link', { current: 'page' });
    expect(current.length).toBeGreaterThan(0);
    current.forEach((link) => expect(link).toHaveAccessibleName('Contas'));
  });

  it('mostra o selo "Modo demo" só para usuário anônimo', async () => {
    const demo = renderApp(<AppShell />, { gateway: fakeGateway(signedIn(true)).gateway, path: '/*' });
    expect(await screen.findByText('Modo demo')).toBeInTheDocument();
    demo.unmount();
    renderApp(<AppShell />, { path: '/*' });
    await screen.findAllByRole('link', { name: 'Painel' });
    expect(screen.queryByText('Modo demo')).not.toBeInTheDocument();
  });

  it('"Criar conta de verdade" sai da demo e abre o cadastro', async () => {
    const { gateway } = fakeGateway(signedIn(true));
    renderApp(<AppShell />, { gateway, path: '/*', extraRoutes: { '/entrar': <p>Cadastro</p> } });
    await userEvent.click(await screen.findByRole('button', { name: 'Criar conta de verdade' }));
    expect(gateway.signOut).toHaveBeenCalled();
  });

  it('"Empréstimos" está nas duas navegações e aponta para /emprestimos', async () => {
    renderApp(<AppShell />, { path: '/*' });
    const links = await screen.findAllByRole('link', { name: 'Empréstimos' });
    expect(links).toHaveLength(2);
    links.forEach((l) => expect(l).toHaveAttribute('href', '/emprestimos'));
  });

  it('"Planejamento" no menu e na barra do celular; "Categorias" só no menu do computador (P9)', async () => {
    renderApp(<AppShell />, { path: '/*' });
    const desktop = await screen.findByRole('navigation', { name: 'Principal' });
    const mobile = screen.getByRole('navigation', { name: 'Principal (celular)' });
    expect(within(desktop).getByRole('link', { name: 'Planejamento' })).toHaveAttribute('href', '/planejamento');
    expect(within(desktop).getByRole('link', { name: 'Categorias' })).toBeInTheDocument();
    expect(within(mobile).getByRole('link', { name: 'Planejamento' })).toBeInTheDocument();
    expect(within(mobile).queryByRole('link', { name: 'Categorias' })).not.toBeInTheDocument();
  });

  it('o sino de notificações fica no topo de todas as telas, com os não lidos (N9)', async () => {
    renderApp(<AppShell />, { path: '/*', api: fakeApi({ 'GET /notifications': { items: [], unreadCount: 3 } }) });
    expect(await screen.findByRole('link', { name: 'Notificações, 3 não lidas' })).toHaveAttribute('href', '/notificacoes');
  });

  it('"Relatórios" só no menu do computador (R12); no celular, o acesso é pelo painel e pelo Perfil', async () => {
    renderApp(<AppShell />, { path: '/*' });
    const desktop = await screen.findByRole('navigation', { name: 'Principal' });
    const mobile = screen.getByRole('navigation', { name: 'Principal (celular)' });
    expect(within(desktop).getByRole('link', { name: 'Relatórios' })).toHaveAttribute('href', '/relatorios');
    expect(within(mobile).queryByRole('link', { name: 'Relatórios' })).not.toBeInTheDocument();
  });
});
