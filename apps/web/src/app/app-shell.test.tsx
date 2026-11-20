import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';
import { fakeApi, fakeGateway, signedIn } from '../test/fakes';
import { renderApp } from '../test/render';
import { AppShell } from './app-shell';

// Voltar e avançar do navegador, sem clicar em nada (com a folha aberta, o Radix bloqueia cliques fora dela).
let go: (delta: number) => void = () => {};
function HistoryProbe() {
  const navigate = useNavigate();
  go = (delta) => void navigate(delta);
  return null;
}

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

  it('no celular, a barra tem Painel, Lançamentos, Contas, o "+" e o "Mais" (sub-projeto 16, L6)', async () => {
    renderApp(<AppShell />, { path: '/*' });
    const mobile = await screen.findByRole('navigation', { name: 'Principal (celular)' });
    expect(within(mobile).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/', '/lancamentos', '/contas']);
    expect(within(mobile).getByRole('button', { name: 'Novo lançamento' })).toBeInTheDocument();
    expect(within(mobile).getByRole('button', { name: 'Mais' })).toBeInTheDocument();
  });

  it('o menu do computador tem todas as telas; as que saíram da barra do celular ficam na folha "Mais"', async () => {
    renderApp(<AppShell />, { path: '/*' });
    const desktop = await screen.findByRole('navigation', { name: 'Principal' });
    for (const [name, href] of [['Planejamento', '/planejamento'], ['Empréstimos', '/emprestimos'], ['Relatórios', '/relatorios'], ['Categorias', '/categorias']]) {
      expect(within(desktop).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Principal (celular)' })).getByRole('button', { name: 'Mais' }));
    const more = await screen.findByRole('dialog', { name: 'Mais' });
    expect(within(more).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Planejamento', 'Calendário', 'Empréstimos', 'Dívidas', 'Patrimônio', 'Resumo do mês', 'Relatórios', 'Assistente', 'Categorias', 'Perfil',
    ]);
  });

  it('escolher uma tela no "Mais" abre a tela e fecha a folha', async () => {
    renderApp(<AppShell />, { path: '/*' });
    await userEvent.click(await screen.findByRole('button', { name: 'Mais' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Mais' })).getByRole('link', { name: 'Dívidas' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mais' })).not.toBeInTheDocument());
    // Na tela de Dívidas, o "Mais" fica marcado como a seção atual.
    expect(screen.getByRole('button', { name: 'Mais' }).className).toContain('bg-primary-soft');
  });

  it('voltar e avançar no navegador fecham a folha "Mais" e não a reabrem (CodeRabbit)', async () => {
    renderApp(
      <>
        <AppShell />
        <HistoryProbe />
      </>,
      { route: '/contas', path: '/*' },
    );
    const mobile = await screen.findByRole('navigation', { name: 'Principal (celular)' });
    await userEvent.click(within(mobile).getByRole('link', { name: 'Painel' }));
    await userEvent.click(within(mobile).getByRole('button', { name: 'Mais' }));
    expect(await screen.findByRole('dialog', { name: 'Mais' })).toBeInTheDocument();
    act(() => go(-1));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mais' })).not.toBeInTheDocument());
    act(() => go(1));
    await waitFor(() => expect(within(mobile).getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page'));
    expect(screen.queryByRole('dialog', { name: 'Mais' })).not.toBeInTheDocument();
  });

  it('o "+" da barra abre o novo lançamento em qualquer tela', async () => {
    renderApp(<AppShell />, { route: '/contas', path: '/*' });
    await userEvent.click(await screen.findByRole('button', { name: 'Novo lançamento' }));
    expect(await screen.findByRole('dialog', { name: 'Novo lançamento' })).toBeInTheDocument();
  });

  it('o sino de notificações fica no topo de todas as telas, com os não lidos (N9)', async () => {
    renderApp(<AppShell />, { path: '/*', api: fakeApi({ 'GET /notifications': { items: [], unreadCount: 3 } }) });
    expect(await screen.findByRole('link', { name: 'Notificações, 3 não lidas' })).toHaveAttribute('href', '/notificacoes');
  });
});
