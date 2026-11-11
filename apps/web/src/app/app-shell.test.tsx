import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeGateway, signedIn } from '../test/fakes';
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
});
