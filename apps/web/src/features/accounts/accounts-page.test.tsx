import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi } from '../../test/fakes';
import { renderApp } from '../../test/render';
import AccountsPage from './accounts-page';

const account = (over: Record<string, unknown> = {}) => ({
  id: 'a1', name: 'Nubank', type: 'checking', color: '#6366F1', initialBalance: 0, balance: 1248050, archivedAt: null, createdAt: '2026-11-01T00:00:00Z', ...over,
});

describe('AccountsPage', () => {
  it('lista as contas com o saldo formatado', async () => {
    renderApp(<AccountsPage />, { api: fakeApi({ 'GET /accounts': [account(), account({ id: 'a2', name: 'Carteira', type: 'wallet', balance: -500 })] }) });
    const item = await screen.findByRole('article', { name: 'Nubank' });
    expect(item).toHaveTextContent(/R\$\s*12\.480,50/);
    expect(screen.getByRole('article', { name: 'Carteira' })).toHaveTextContent('Carteira');
  });

  it('sem contas mostra o estado vazio com a ação de criar', async () => {
    renderApp(<AccountsPage />, { api: fakeApi({ 'GET /accounts': [] }) });
    expect(await screen.findByRole('heading', { name: 'Nenhuma conta ainda' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nova conta' }).length).toBeGreaterThan(0);
  });

  it('cria conta pelo formulário enviando centavos', async () => {
    const api = fakeApi({ 'GET /accounts': [], 'POST /accounts': account() });
    renderApp(<AccountsPage />, { api });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Nova conta' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Nubank');
    await userEvent.type(within(dialog).getByLabelText('Saldo inicial'), '150000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar conta' }));
    expect(api.post).toHaveBeenCalledWith('/accounts', expect.objectContaining({ name: 'Nubank', type: 'checking', initialBalance: 150000 }));
  });
});
